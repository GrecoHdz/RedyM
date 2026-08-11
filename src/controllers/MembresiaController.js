const { Sequelize, Op } = require("sequelize");
const Membresia = require("../models/membresiaModel");
const Config = require("../models/configModel");
const Usuario = require("../models/usuariosModel");
const Cuenta = require("../models/cuentasModel");
const RedNiveles = require("../models/redNivelesModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");
const NotificacionDestinatario = require("../models/notificacionesDestinatariosModel");
const { encontrarPosicionSiguiente } = require("./redNivelesController");
const { sequelize } = require("../config/database");

// Obtener todas las membresias con información de usuario y cuenta
const obtenerMembresias = async (req, res) => {
    try {
        // Obtener parámetros de paginación y búsqueda
        let limit = parseInt(req.query.limit) || 100;
        limit = Math.min(limit, 1000); // Máximo 1000 para reportes
        const offset = parseInt(req.query.offset) || 0;
        const searchTerm = req.query.search || '';
        const estado = req.query.estado;
        const month = req.query.month; // Formato: 'YYYY-MM'

        // Construir condiciones de búsqueda
        const whereCondition = {};
        const andConditions = [];

        // Filtro por término de búsqueda
        if (searchTerm) {
            andConditions.push({
                [Op.or]: [
                    { '$usuario.nombre$': { [Op.like]: `%${searchTerm}%` } },
                    { '$usuario.telefono$': { [Op.like]: `%${searchTerm}%` } },
                    { num_transaccion: { [Op.like]: `%${searchTerm}%` } }
                ]
            });
        }

        // Filtro por estado
        if (estado) {
            whereCondition.estado = estado;
        }

        // Filtro por mes
        if (month) {
            const [year, monthNum] = month.split('-').map(Number);
            andConditions.push(
                Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('Membresia.fecha')), year),
                Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('Membresia.fecha')), monthNum)
            );
        }

        // Combinar condiciones
        if (andConditions.length > 0) {
            whereCondition[Op.and] = andConditions;
        }

        // Obtener total de registros
        const total = await Membresia.count({
            where: whereCondition,
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: []
                }
            ]
        });

        // Obtener membresías con paginación
        const [membresias, stats] = await Promise.all([
            Membresia.findAll({
                where: whereCondition,
                attributes: { exclude: ['id_usuario', 'id_cuenta'] },
                include: [
                    {
                        model: Usuario,
                        as: 'usuario',
                        attributes: ['id_usuario', 'nombre', 'telefono', 'imagen_url']
                    },
                    {
                        model: Usuario,
                        as: 'pagador',
                        attributes: ['id_usuario', 'nombre']
                    },
                    {
                        model: Cuenta,
                        as: 'cuenta',
                        attributes: ['banco', 'beneficiario', 'num_cuenta', 'tipo']
                    }
                ],
                order: [['fecha', 'DESC']],
                limit,
                offset,
                raw: true,
                nest: true
            }),

            // Consulta de estadísticas
            Membresia.findAll({
                attributes: [
                    [Sequelize.literal("COUNT(CASE WHEN estado = 'activa' OR estado = 'vencida' THEN 1 END)"), 'activas'],
                    [Sequelize.literal("COUNT(CASE WHEN estado = 'pendiente' THEN 1 END)"), 'pendientes'],
                    [Sequelize.literal("COUNT(CASE WHEN estado = 'rechazada' THEN 1 END)"), 'rechazadas'],
                    [Sequelize.literal("SUM(CASE WHEN estado IN ('activa', 'vencida') THEN monto ELSE 0 END)"), 'total']
                ],
                where: whereCondition,
                raw: true
            })
        ]);

        // Procesar estadísticas
        const statsData = stats[0] || { activas: 0, pendientes: 0, rechazadas: 0, total: 0 };
        const estadisticas = {
            aprobados: parseInt(statsData.activas) || 0,
            rechazados: parseInt(statsData.rechazadas) || 0,
            pendientes: parseInt(statsData.pendientes) || 0,
            total: parseFloat(statsData.total) || 0
        };

        res.json({
            success: true,
            data: membresias,
            total,
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(total / limit),
            hasMore: offset + limit < total,
            estadisticas
        });
    } catch (error) {
        console.error("Error al obtener membresías:", error);
        res.status(500).json({
            success: false,
            error: "Error al obtener membresías",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Obtener membresía por ID
const obtenerMembresiaPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const whereCondition = {
            id_membresia: id
        };

        // Total (para que el frontend no falle)
        const total = await Membresia.count({ where: whereCondition });

        if (total === 0) {
            return res.json({
                success: false,
                data: [],
                total: 0,
                page: 1,
                totalPages: 0,
                hasMore: false,
                estadisticas: {
                    aprobados: 0,
                    rechazados: 0,
                    pendientes: 0,
                    total: 0
                }
            });
        }

        const [membresias, stats] = await Promise.all([
            Membresia.findAll({
                where: whereCondition,
                attributes: { exclude: ['id_usuario', 'id_cuenta'] },
                include: [
                    {
                        model: Usuario,
                        as: 'usuario',
                        attributes: ['id_usuario', 'nombre', 'telefono', 'imagen_url']
                    },
                    {
                        model: Cuenta,
                        as: 'cuenta',
                        attributes: ['banco', 'beneficiario', 'num_cuenta', 'tipo']
                    }
                ],
                order: [['fecha', 'DESC']],
                raw: true,
                nest: true
            }),

            // Estadísticas (misma lógica)
            Membresia.findAll({
                attributes: [
                    [Sequelize.literal("COUNT(CASE WHEN estado IN ('activa','vencida') THEN 1 END)"), 'activas'],
                    [Sequelize.literal("COUNT(CASE WHEN estado = 'pendiente' THEN 1 END)"), 'pendientes'],
                    [Sequelize.literal("COUNT(CASE WHEN estado = 'rechazada' THEN 1 END)"), 'rechazadas'],
                    [Sequelize.literal("SUM(CASE WHEN estado IN ('activa','vencida') THEN monto ELSE 0 END)"), 'total']
                ],
                where: whereCondition,
                raw: true
            })
        ]);

        const statsData = stats[0] || {};
        const estadisticas = {
            aprobados: parseInt(statsData.activas) || 0,
            rechazados: parseInt(statsData.rechazadas) || 0,
            pendientes: parseInt(statsData.pendientes) || 0,
            total: parseFloat(statsData.total) || 0
        };

        return res.json({
            success: true,
            data: membresias,
            total: 1,
            page: 1,
            totalPages: 1,
            hasMore: false,
            estadisticas
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Error al obtener la membresía',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Obtener historial completo de membresías de un usuario
const obtenerHistorialMembresias = async (req, res) => {
    try {
        const membresias = await Membresia.findAll({
            where: { id_usuario: req.params.id },
            order: [['fecha', 'DESC']], // Ordenar por fecha descendente
            raw: true
        });

        if (!membresias || membresias.length === 0) {
            return res.status(404).json({
                status: 'not_found',
                message: 'No se encontraron membresías para este usuario'
            });
        }

        res.json({
            status: 'success',
            data: membresias,
            count: membresias.length
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error al obtener el historial de membresías',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Obtener la membresía activa más reciente de un usuario
const obtenerMembresiaActual = async (req, res) => {
    try {
        const { id } = req.params;

        // Caso especial: El primer usuario registrado (Empresa) siempre está activo
        const firstUser = await Usuario.findOne({ order: [['id_usuario', 'ASC']], attributes: ['id_usuario'] });
        const rootId = firstUser ? firstUser.id_usuario : 1;

        if (parseInt(id) === rootId) {
            return res.json({
                status: 'success',
                data: {
                    id_membresia: 0,
                    id_usuario: rootId,
                    estado: 'activa',
                    fecha: new Date(),
                    monto: 0,
                    num_transaccion: 'SISTEMA'
                }
            });
        }

        const membresia = await Membresia.findOne({
            where: { id_usuario: id },
            order: [['fecha', 'DESC']],
            raw: true
        });

        if (!membresia) {
            return res.json({
                status: 'not_found',
                data: null,
                message: 'El usuario no tiene una membresía activa.'
            });
        }

        return res.json({
            status: 'success',
            data: membresia
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: 'Error al obtener la membresía actual',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Obtener progreso de membresía por usuario
const obtenerProgresoMembresia = async (req, res) => {
    try {

        // Obtener configuración de membresía, descuentos, beneficios y días de gracia
        const [configs, beneficios, configMembresia, configGracia] = await Promise.all([
            Config.findAll({
                where: {
                    tipo_config: {
                        [Op.or]: ['porcentaje_descuento', 'porcentaje_descuento_especial']
                    }
                },
                raw: true
            }),
            MembresiaBeneficio.findAll({
                where: {
                    tipo_beneficio: {
                        [Op.or]: ['CashBack en todos los servicios', 'CashBack Especial en todos los Servicios']
                    }
                },
                raw: true
            }),
            Config.findOne({
                where: { tipo_config: 'valor_membresia' },
                raw: true
            }),
            Config.findOne({
                where: { tipo_config: 'dias_gracia_membresia' },
                raw: true
            })
        ]);

        // Caso especial: El primer usuario registrado (Empresa)
        const firstUser = await Usuario.findOne({ order: [['id_usuario', 'ASC']], attributes: ['id_usuario'] });
        const rootId = firstUser ? firstUser.id_usuario : 1;

        if (parseInt(req.params.id_usuario) === rootId) {
            return res.json({
                status: 'success',
                mesesProgreso: 999,
                montoTotal: 0,
                valorMembresia: 0,
                porcentaje_descuento: '0'
            });
        }

        if (!configMembresia) {
            return res.status(500).json({
                status: 'error',
                message: 'No se encontró la configuración de membresía'
            });
        }

        const valorMembresia = configMembresia.valor;
        const diasGracia = parseInt(configGracia?.valor || '5', 10);
        const diasPorMes = 30 + diasGracia;

        // Obtener membresías del usuario
        const membresias = await Membresia.findAll({
            where: {
                id_usuario: req.params.id_usuario,
                estado: ['activa', 'vencida']
            },
            order: [['fecha', 'ASC']],
            raw: true
        });

        if (!membresias || membresias.length === 0) {
            return res.json({
                status: 'success',
                mesesProgreso: 0,
                montoTotal: 0,
                valorMembresia,
                porcentaje_descuento: '0'
            });
        }

        // Procesar fechas de membresías
        const fechasMembresias = membresias
            .filter(m => m.estado === 'activa' || m.estado === 'vencida')
            .map(m => new Date(m.fecha))
            .sort((a, b) => a - b);

        // Calcular progreso basado en la fecha actual y período de gracia
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Ordenar fechas de más reciente a más antigua
        let fechasOrdenadas = fechasMembresias.sort((a, b) => b - a);

        // Calcular meses consecutivos verificando gaps entre pagos
        let mesesConsecutivos = 0;

        // Verificar si el pago más reciente está vigente (dentro del período de gracia desde hoy)
        const pagoMasReciente = fechasOrdenadas[0];
        const diffDesdeHoy = Math.floor((hoy - pagoMasReciente) / (1000 * 60 * 60 * 24));

        if (diffDesdeHoy > diasPorMes) {
            // Actualizar RedNiveles para sacar al usuario de la matriz físicamente
            // Ignorar si es el usuario raíz (el primero registrado)
            const id_usuario_p = parseInt(req.params.id_usuario);
            
            const firstUser = await Usuario.findOne({
                order: [['id_usuario', 'ASC']],
                attributes: ['id_usuario']
            });
            const rootId = firstUser ? firstUser.id_usuario : 1;

            if (id_usuario_p !== rootId) {
                await RedNiveles.update(
                    { id_padre: null, posicion: null, nivel_actual: 0 },
                    { where: { id_usuario: id_usuario_p } }
                );
            }

            return res.json({
                status: 'success',
                mesesProgreso: 0,
                montoTotal: 0,
                valorMembresia,
                porcentaje_descuento: '0'
            });
        }

        // --- Detección de Vencimiento y Periodo de Gracia para Notificaciones ---
        try {
            const hoyNotif = new Date();
            const diffDiasNotif = Math.floor((hoyNotif - pagoMasReciente) / (1000 * 60 * 60 * 24));
            
            // 1. Caso: Membresía ha vencido (superó periodo de gracia)
            if (diffDiasNotif >= diasPorMes) {
                await NotificacionDestinatario.notificar({
                    tipo: 'membresia',
                    titulo: 'Tu membresía ha vencido',
                    id_usuario: req.params.id_usuario,
                    creado_por: 'Sistema'
                });
            } 
            // 2. Caso: Periodo de gracia (entre 30 y 30+diasGracia)
            else if (diffDiasNotif >= 30) {
                let autoRenovada = await intentarAutoRenovacion(req.params.id_usuario, valorMembresia);

                if (!autoRenovada) {
                    await NotificacionDestinatario.notificar({
                        tipo: 'membresia',
                        titulo: 'Aviso: Tu membresía vence pronto (Periodo de gracia)',
                        id_usuario: req.params.id_usuario,
                        creado_por: 'Sistema'
                    });
                } else {
                    // Si se auto-renovó, debemos volver a cargar las fechas de membresía
                    const nuevasMembresias = await Membresia.findAll({
                        where: {
                            id_usuario: req.params.id_usuario,
                            estado: ['activa', 'vencida']
                        },
                        order: [['fecha', 'ASC']],
                        raw: true
                    });
                    
                    fechasOrdenadas = nuevasMembresias
                        .map(m => new Date(m.fecha))
                        .sort((a, b) => b - a);
                }
            }
        } catch (notifErr) {
            console.error("Error al procesar notificaciones automáticas de vencimiento:", notifErr);
        }
        // -----------------------------------------------------------------------

        // El primer pago cuenta
        mesesConsecutivos = 1;

        // Verificar los pagos subsecuentes
        for (let i = 0; i < fechasOrdenadas.length - 1; i++) {
            const pagoActual = fechasOrdenadas[i];
            const pagoAnterior = fechasOrdenadas[i + 1];

            // Calcular diferencia en días entre este pago y el anterior
            const diffTiempo = pagoActual - pagoAnterior;
            const diffDias = Math.floor(diffTiempo / (1000 * 60 * 60 * 24));

            // Si la diferencia es mayor o igual a diasPorMes días, hay un gap y se rompe la cadena
            if (diffDias >= diasPorMes) {
                break;
            }

            // Si está dentro del rango, cuenta como mes consecutivo
            mesesConsecutivos++;
        }

        if (mesesConsecutivos === 0) {
            return res.json({
                status: 'success',
                mesesProgreso: 0,
                montoTotal: 0,
                valorMembresia,
                porcentaje_descuento: '0'
            });
        }

        const montoTotal = valorMembresia * mesesConsecutivos;

        // Determinar el descuento aplicable basado en el progreso
        const configDescuentoEspecial = configs.find(c => c.tipo_config === 'porcentaje_descuento_especial');
        const configDescuentoRegular = configs.find(c => c.tipo_config === 'porcentaje_descuento');

        const beneficioEspecial = beneficios.find(b =>
            b.tipo_beneficio === 'CashBack Especial en todos los Servicios'
        );
        const beneficioRegular = beneficios.find(b =>
            b.tipo_beneficio === 'CashBack en todos los servicios'
        );

        const mesRequeridoEspecial = parseInt(beneficioEspecial?.mes_requerido || '0', 10);
        const mesRequeridoRegular = parseInt(beneficioRegular?.mes_requerido || '0', 10);

        // Determinar el descuento: prioridad al especial si ambos califican
        let porcentajeDescuento = '0';

        if (mesesConsecutivos >= mesRequeridoEspecial && mesRequeridoEspecial > 0) {
            porcentajeDescuento = configDescuentoEspecial?.valor || '0';
        } else if (mesesConsecutivos >= mesRequeridoRegular && mesRequeridoRegular > 0) {
            porcentajeDescuento = configDescuentoRegular?.valor || '0';
        }

        res.json({
            status: 'success',
            mesesProgreso: mesesConsecutivos,
            montoTotal,
            valorMembresia,
            porcentaje_descuento: porcentajeDescuento
        });

    } catch (error) {
        console.error("Error al obtener progreso de membresía:", error);
        res.status(500).json({
            status: 'error',
            message: 'Error al obtener progreso de membresía',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

//Crear membresia
const crearMembresia = async (req, res) => {
    try {
        const datosMembresia = {
            ...req.body,
            fecha: new Date(),  // Agregar la fecha actual
            estado: 'pendiente' // Establecer estado inicial como pendiente
        };

        const membresia = await Membresia.create(datosMembresia);

        // Enviar notificación de pago recibido al usuario
        try {
            await NotificacionDestinatario.notificar({
                tipo: 'membresia',
                titulo: 'Pago de membresía recibido',
                id_usuario: membresia.id_usuario,
                creado_por: 'Sistema'
            });
        } catch (notifyError) {
            console.error("Error al enviar notificación de pago recibido:", notifyError);
        }

        // Enviar notificación a los administradores
        try {
            const Rol = require('../models/rolesModel');
            const Usuario = require('../models/usuariosModel');
            const rolAdmin = await Rol.findOne({ where: { nombre_rol: 'Admin' } });
            
            if (rolAdmin) {
                const admins = await Usuario.findAll({ where: { id_rol: rolAdmin.id_rol } });
                for (let admin of admins) {
                    await NotificacionDestinatario.notificar({
                        tipo: 'membresia',
                        titulo: 'Pago de membresía recibido',
                        id_usuario: admin.id_usuario,
                        creado_por: 'Sistema'
                    });
                }
            }
        } catch (adminNotifyError) {
            console.error('Error enviando notificación a admins:', adminNotifyError);
        }

        res.json(membresia);
    } catch (error) {
        console.error("Error al crear membresía:", error);
        res.status(500).json({
            error: "Error al crear membresía",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

//Actualizar membresia
const actualizarMembresia = async (req, res) => {
    try {
        const [updated] = await Membresia.update(req.body, {
            where: {
                id_membresia: req.params.id
            }
        });

        if (updated) {
            const updatedMembresia = await Membresia.findByPk(req.params.id);
            return res.json({
                status: 'success',
                data: updatedMembresia
            });
        }

        throw new Error('No se pudo actualizar la membresía');
    } catch (error) {
        console.error("Error al actualizar membresia:", error);
        res.status(500).json({
            status: 'error',
            message: 'Error al actualizar membresía',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

//Eliminar membresia
const eliminarMembresia = async (req, res) => {
    try {
        const membresia = await Membresia.destroy({ where: { id_membresia: req.params.id } });
        res.json(membresia);
    } catch (error) {
        console.error("Error al eliminar membresía:", error);
        res.status(500).json({
            error: "Error al eliminar membresía",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Intentar auto-renovación de membresía si el usuario tiene saldo suficiente
// soloActivar = true: solo marca la membresía como activa sin re-posicionar en la red.
// Usar soloActivar = true cuando se llama desde actualizarRedCompleta, ya que el rebuild
// se encarga de re-posicionar a todos los usuarios en el paso 6.
const intentarAutoRenovacion = async (id_usuario, valorMembresia, tPadre = null, soloActivar = false) => {
    let autoRenovada = false;
    try {
        console.log(`[AutoRenovacion] 🔍 Iniciando auto-renovación para usuario ${id_usuario}. Valor membresía esperado: $${valorMembresia}. Modo: ${soloActivar ? 'soloActivar' : 'completo'}`);
        const saldo = await CreditoUsuario.findOne({ where: { id_usuario } });
        
        if (saldo) {
            console.log(`[AutoRenovacion] 💰 Saldo actual del usuario ${id_usuario}: $${saldo.monto_credito}`);
        } else {
            console.log(`[AutoRenovacion] ❌ No se encontró billetera de saldo para el usuario ${id_usuario}`);
        }

        if (saldo && parseFloat(saldo.monto_credito) >= parseFloat(valorMembresia)) {
            console.log(`[AutoRenovacion] ✅ Saldo suficiente. Descontando $${valorMembresia} y procesando renovación...`);
            const tAuto = tPadre || await sequelize.transaction();
            try {
                // Descontar saldo
                await CreditoUsuario.decrement('monto_credito', {
                    by: valorMembresia,
                    where: { id_usuario },
                    transaction: tAuto
                });

                // Crear nueva membresía pendiente
                const nuevaMembresia = await Membresia.create({
                    id_usuario,
                    monto: valorMembresia,
                    fecha: new Date(),
                    estado: 'pendiente',
                    num_transaccion: 'AUTO_RENOVACION_SISTEMA'
                }, { transaction: tAuto });

                if (soloActivar) {
                    // Modo rebuild: solo marcar como activa.
                    // El rebuild re-posiciona al usuario en el paso 6 y distribuye comisiones.
                    // No llamamos _aprobarMembresiaInterno para evitar doble posicionamiento
                    // y pagos de comisión incorrectos (entrada nueva vs. renovación).
                    await nuevaMembresia.update({ estado: 'activa' }, { transaction: tAuto });
                    console.log(`[AutoRenovacion] 🔄 Modo soloActivar: membresía marcada como activa sin re-posicionar en red.`);
                } else {
                    // Modo normal: aprobar y colocar/renovar en la red completa
                    await _aprobarMembresiaInterno(nuevaMembresia, tAuto);
                }

                if (!tPadre) await tAuto.commit();
                autoRenovada = true;
                console.log(`[AutoRenovacion] ✨ Auto-renovación completada exitosamente para usuario ${id_usuario}`);

                // Notificar al usuario de la auto-renovación
                await NotificacionDestinatario.notificar({
                    tipo: 'membresia',
                    titulo: 'Auto-renovación de membresía cobrada de tu saldo 🔄',
                    id_usuario,
                    creado_por: 'Sistema'
                });
            } catch (errAuto) {
                if (!tPadre) await tAuto.rollback();
                console.error("Error en auto-renovación interna:", errAuto);
            }
        } else if (saldo) {
             console.log(`[AutoRenovacion] ⚠️ Saldo insuficiente ($${saldo.monto_credito}) para cubrir $${valorMembresia}`);
        }
    } catch (err) {
        console.error("Error consultando saldo para auto-renovación:", err);
    }
    return autoRenovada;
};

// Función interna para aprobar membresía (puede ser llamada por auto-renovación)
const _aprobarMembresiaInterno = async (membresia, t) => {
    const id_usuario = membresia.id_usuario;

    // 2. Obtener el registro de red del usuario
    const nodoRed = await RedNiveles.findOne({ where: { id_usuario }, transaction: t });
    if (!nodoRed) throw new Error("Registro de red no encontrado para el usuario");

    let lugar = null;

    // 3. Si el usuario está en Nivel 0 (Pendiente de activación inicial)
    if (nodoRed.nivel_actual === 0) {
        console.log(`[_aprobarMembresiaInterno] Colocando usuario ${id_usuario} en la red desde patrocinador ${nodoRed.id_patrocinador}`);
        
        // Buscar lugar en la red por derrame desde su patrocinador
        lugar = await encontrarPosicionSiguiente(nodoRed.id_patrocinador);

        // Si el patrocinador no tiene lugar (o red llena bajo él), buscar desde la raíz (Primer usuario)
        if (!lugar) {
            console.log(`[_aprobarMembresiaInterno] Sponsor ${nodoRed.id_patrocinador} full, buscando desde raíz`);
            const firstUser = await Usuario.findOne({ order: [['id_usuario', 'ASC']], attributes: ['id_usuario'] });
            const rootId = firstUser ? firstUser.id_usuario : 1;
            lugar = await encontrarPosicionSiguiente(rootId);
        }

        if (!lugar) throw new Error("No hay espacios disponibles en la red global");

        console.log(`[_aprobarMembresiaInterno] Lugar encontrado: Padre=${lugar.id_padre}, Posicion=${lugar.posicion}`);

        // Actualizar nodo de red con posición y nivel 1
        await nodoRed.update({
            id_padre: lugar.id_padre,
            posicion: lugar.posicion,
            nivel_actual: 1
        }, { transaction: t });

        // Pagar comisión al patrocinador (100% de la membresía inicial)
        // Usamos el monto pagado en la membresía
        await CreditoUsuario.increment('monto_credito', {
            by: membresia.monto,
            where: { id_usuario: nodoRed.id_patrocinador },
            transaction: t
        });

        // Enviar notificación de comisión por referido
        try {
            await NotificacionDestinatario.notificar({
                tipo: 'financieros',
                titulo: 'Comisión por referido recibida 💰',
                id_usuario: nodoRed.id_patrocinador,
                creado_por: 'Sistema'
            });
        } catch (notifyError) {
            console.error("Error al enviar notificación de comisión:", notifyError);
        }

    } else {
        // Si ya estaba en nivel 1+, es una renovación
        if (nodoRed && nodoRed.id_padre) {
            console.log(`[_aprobarMembresiaInterno-Renovacion] Acreditando renovación de ${id_usuario} al padre ${nodoRed.id_padre} por monto ${membresia.monto}`);
            await CreditoUsuario.increment('monto_credito', {
                by: membresia.monto,
                where: { id_usuario: nodoRed.id_padre },
                transaction: t
            });

            // Enviar notificación al padre
            try {
                await NotificacionDestinatario.notificar({
                    tipo: 'financieros',
                    titulo: 'Comisión residual por renovación mensual 💰',
                    id_usuario: nodoRed.id_padre,
                    creado_por: 'Sistema'
                });
            } catch (notifyError) {
                console.error("Error al enviar notificación de renovación al padre:", notifyError);
            }
        }
    }

    await membresia.update({ estado: 'activa' }, { transaction: t });

    // 5. Enviar notificación de activación exitosa al usuario
    try {
        await NotificacionDestinatario.notificar({
            tipo: 'membresia',
            titulo: 'Membresía activada exitosamente 🏆',
            id_usuario: membresia.id_usuario,
            creado_por: 'Sistema'
        });
    } catch (notifyError) {
        console.error("Error al enviar notificación de membresía activada:", notifyError);
    }

    // 6. Si es un regalo (YA APROBADO), enviar notificación final al destinatario y al pagador
    if (membresia.id_pagador) {
        try {
            // Al destinatario
            await NotificacionDestinatario.notificar({
                tipo: 'usuario',
                titulo: 'Has recibido un regalo de membresía 🎁',
                id_usuario: membresia.id_usuario,
                creado_por: 'Sistema'
            }); 
        } catch (notifyError) {
            console.error("Error al enviar notificaciones de regalo de membresía aprobado:", notifyError);
        }
    }

    // 7. INTENTAR UPGRADES AUTOMÁTICOS
    const { procesarAutoUpgradeInterno } = require("./redNivelesController");
    
    const id_padre_a_subir = lugar ? lugar.id_padre : nodoRed.id_padre;
    
    if (id_padre_a_subir) {
        await procesarAutoUpgradeInterno(id_padre_a_subir, t);
    }
    
    if (nodoRed && nodoRed.id_patrocinador) {
        await procesarAutoUpgradeInterno(nodoRed.id_patrocinador, t);
    }
};

// Aprobar membresía y colocar en la red si es necesario (Endpoint HTTP)
const aprobarMembresia = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        // 1. Obtener la solicitud de membresía
        const membresia = await Membresia.findByPk(id, { transaction: t });
        if (!membresia) throw new Error("Solicitud no encontrada");
        if (membresia.estado !== 'pendiente') throw new Error("La solicitud ya ha sido procesada");

        await _aprobarMembresiaInterno(membresia, t);

        await t.commit();
        res.json({ success: true, message: "Membresía aprobada y usuario activado en la red" });

    } catch (error) {
        await t.rollback();
        console.error("Error al aprobar membresía:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Regalar membresía usando saldo
const regalarMembresia = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id_usuario_destino, id_usuario_pagador, monto } = req.body;

        // 1. Validar saldo del pagador
        const saldo = await CreditoUsuario.findOne({ where: { id_usuario: id_usuario_pagador }, transaction: t });
        if (!saldo || saldo.monto_credito < monto) {
            throw new Error("Saldo insuficiente para regalar la membresía");
        }

        // 2. Descontar saldo inmediatamente
        await CreditoUsuario.decrement('monto_credito', {
            by: monto,
            where: { id_usuario: id_usuario_pagador },
            transaction: t
        });

        // 3. Crear solicitud de membresía pendiente
        const membresia = await Membresia.create({
            id_usuario: id_usuario_destino,
            id_pagador: id_usuario_pagador,
            monto,
            fecha: new Date(),
            estado: 'pendiente',
            num_comprobante: `REGALO_DE_USUARIO_${id_usuario_pagador}`
        }, { transaction: t });

        await t.commit();

        // 4. Enviar notificaciones de solicitud de regalo
        try {
            // Notificar al que regala
            await NotificacionDestinatario.notificar({
                tipo: 'usuario',
                titulo: 'Solicitud de regalo de membresía enviada 🎁',
                id_usuario: id_usuario_pagador,
                creado_por: 'Sistema'
            });
        } catch (notifyError) {
            console.error("Error al enviar notificaciones de solicitud de regalo:", notifyError);
        }

        res.status(201).json({ success: true, message: "Regalo enviado. Pendiente de aprobación por admin.", data: membresia });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

// Rechazar membresía (con devolución de saldo si aplica)
const rechazarMembresia = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const membresia = await Membresia.findByPk(id, { transaction: t });

        if (!membresia) throw new Error("Membresía no encontrada");
        if (membresia.estado !== 'pendiente') throw new Error("Solo se pueden rechazar solicitudes pendientes");

        // Si hay pagador (regalo), devolver el saldo
        if (membresia.id_pagador) {
            await CreditoUsuario.increment('monto_credito', {
                by: membresia.monto,
                where: { id_usuario: membresia.id_pagador },
                transaction: t
            });
        }

        await membresia.update({ estado: 'rechazada' }, { transaction: t });

        // Enviar notificaciones de rechazo
        try {
            if (membresia.id_pagador) {
                // 1. Notificar al pagador (si fue un regalo)
                await NotificacionDestinatario.notificar({
                    tipo: 'usuario',
                    titulo: 'Tu regalo de membresía ha sido rechazado ❌',
                    id_usuario: membresia.id_pagador,
                    creado_por: 'Sistema'
                });

                // 2. Notificar al destinatario con el mensaje específico de regalo
                await NotificacionDestinatario.notificar({
                    tipo: 'usuario',
                    titulo: 'Tu regalo de membresía ha sido rechazado ❌',
                    id_usuario: membresia.id_usuario,
                    creado_por: 'Sistema'
                });
            } else {
                // 3. Notificar al usuario destino (si fue pago directo)
                await NotificacionDestinatario.notificar({
                    tipo: 'membresia',
                    titulo: 'Pago de membresía rechazado',
                    id_usuario: membresia.id_usuario,
                    creado_por: 'Sistema'
                });
            }
        } catch (notifyError) {
            console.error("Error al enviar notificaciones de membresía rechazada:", notifyError);
        }

        await t.commit();
        res.json({ success: true, message: "Membresía rechazada y saldo devuelto si correspondía" });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    obtenerMembresias,
    obtenerMembresiaPorId,
    obtenerHistorialMembresias,
    obtenerMembresiaActual,
    crearMembresia,
    actualizarMembresia,
    eliminarMembresia,
    obtenerProgresoMembresia,
    aprobarMembresia,
    regalarMembresia,
    rechazarMembresia,
    intentarAutoRenovacion
};
