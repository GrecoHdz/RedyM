const MisionReclamo = require("../models/MisionReclamoModel");
const MisionEspecial = require("../models/MisionEspecialModel");
const Interaccion = require("../models/InteraccionModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");
const Config = require("../models/configModel");
const Usuario = require("../models/usuariosModel");
const Membresia = require("../models/membresiaModel");
const NotificacionDestinatario = require("../models/notificacionesDestinatariosModel");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");

// Helper to get range of last 24 hours
const getLast24HoursRange = () => {
    return {
        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
    };
};

// Helper to get range of today in local UTC-6 timezone
const getTodayRange = () => {
    const todayStr = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startOfToday = new Date(`${todayStr}T00:00:00-06:00`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999-06:00`);
    
    return {
        [Op.between]: [startOfToday, endOfToday]
    };
};

// Helper to check if user has active membership
const hasActiveMembership = async (id_usuario) => {
    // Caso especial: El primer usuario registrado (Empresa) siempre está activo
    const firstUser = await Usuario.findOne({ order: [['id_usuario', 'ASC']], attributes: ['id_usuario'] });
    if (firstUser && parseInt(id_usuario) === firstUser.id_usuario) return true;

    const membresia = await Membresia.findOne({
        where: { 
            id_usuario,
            estado: 'activa'
        }
    });
    return !!membresia;
};

/**
 * Obtener progreso de las misiones automáticas del día
 */
const getMisionesProgress = async (req, res) => {
    try {
        const id_usuario = req.params.id_usuario || req.user?.id_usuario;
        if (!id_usuario) {
            return res.status(400).json({ success: false, error: "Falta id_usuario" });
        }

        // 1. Contar interacciones únicas por tipo hoy
        const interaccionesHoy = await Interaccion.findAll({
            attributes: [
                'tipo',
                [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('id_publicacion'))), 'cantidad']
            ],
            where: {
                id_usuario,
                tipo: ['like', 'video_view', 'share'],
                fecha: getTodayRange()
            },
            group: ['tipo']
        });

        const progress = {
            likes: 0,
            video: 0,
            share: 0
        };

        interaccionesHoy.forEach(item => {
            const tipo = item.getDataValue('tipo');
            const cantidad = parseInt(item.getDataValue('cantidad'), 10) || 0;
            if (tipo === 'like') progress.likes = cantidad;
            if (tipo === 'video_view') progress.video = cantidad;
            if (tipo === 'share') progress.share = cantidad;
        });

        // 2. Verificar si ya reclamó hoy la misión automática
        const reclamoHoy = await MisionReclamo.findOne({
            where: {
                id_usuario,
                tipo: 'auto',
                fecha: getTodayRange()
            }
        });

        res.json({
            success: true,
            progress,
            rewardClaimed: !!reclamoHoy
        });

    } catch (error) {
        console.error("Error al obtener progreso de misiones:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Reclamar recompensa de misión automática
 */
const reclamarMisionAuto = async (req, res) => {
    try {
        const id_usuario = req.user?.id_usuario || req.body.id_usuario;
        if (!id_usuario) {
            return res.status(400).json({ success: false, error: "Falta id_usuario" });
        }

        // 1. Volver a verificar el progreso en el servidor
        const interaccionesHoy = await Interaccion.findAll({
            attributes: [
                'tipo',
                [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('id_publicacion'))), 'cantidad']
            ],
            where: {
                id_usuario,
                tipo: ['like', 'video_view', 'share'],
                fecha: getTodayRange()
            },
            group: ['tipo']
        });

        const progress = { likes: 0, video: 0, share: 0 };
        interaccionesHoy.forEach(item => {
            const tipo = item.getDataValue('tipo');
            const cantidad = parseInt(item.getDataValue('cantidad'), 10) || 0;
            if (tipo === 'like') progress.likes = cantidad;
            if (tipo === 'video_view') progress.video = cantidad;
            if (tipo === 'share') progress.share = cantidad;
        });

        // Las metas son: 3 likes, 1 video_view, 1 share
        if (progress.likes < 3 || progress.video < 1 || progress.share < 1) {
            return res.status(400).json({
                success: false,
                error: "Misiones no completadas aún",
                progress
            });
        }

        // 2. Verificar que no haya reclamado ya hoy
        const reclamoHoy = await MisionReclamo.findOne({
            where: {
                id_usuario,
                tipo: 'auto',
                fecha: getTodayRange()
            }
        });

        if (reclamoHoy) {
            return res.status(400).json({ success: false, error: "Ya reclamaste la recompensa de hoy" });
        }

        // 3. Obtener el valor configurado para la misión
        const configMision = await Config.findOne({ where: { tipo_config: 'valor_mision' } });
        const rewardValue = configMision ? parseFloat(configMision.valor) : 10.00;

        // 4. Acreditar saldo y registrar reclamo
        const creditoExistente = await CreditoUsuario.findOne({ where: { id_usuario } });
        let nuevoMonto = rewardValue;
        if (creditoExistente) {
            nuevoMonto += parseFloat(creditoExistente.monto_credito);
        }

        await CreditoUsuario.upsert({
            id_usuario,
            monto_credito: parseFloat(nuevoMonto.toFixed(2)),
            fecha: new Date()
        });

        const reclamo = await MisionReclamo.create({
            id_usuario,
            tipo: 'auto',
            estado: 'aprobado',
            monto: rewardValue,
            fecha: new Date()
        });

        // Enviar notificación de misión diaria completada
        try {
            await NotificacionDestinatario.notificar({
                tipo: 'misiones',
                titulo: 'Misión diaria completada 🎉',
                id_usuario: id_usuario,
                creado_por: 'Sistema'
            });
        } catch (notifyError) {
            console.error('Error al enviar notificación de misión diaria:', notifyError);
        }

        res.json({
            success: true,
            message: "Recompensa diaria acreditada correctamente",
            monto_acreditado: rewardValue,
            nuevo_saldo: nuevoMonto,
            data: reclamo
        });

    } catch (error) {
        console.error("Error al reclamar misión automática:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener todas las misiones especiales activas
 */
const getMisionesEspeciales = async (req, res) => {
    try {
        const id_usuario = req.query.id_usuario || req.user?.id_usuario;

        const misiones = await MisionEspecial.findAll({
            where: { activa: true },
            order: [['fecha_creacion', 'DESC']]
        });

        let canClaimMore = true;
        let lastClaimTimestamp = null;
        let isVip = false;

        if (id_usuario) {
            isVip = await hasActiveMembership(id_usuario);
            
            if (!isVip) {
                const lastClaim = await MisionReclamo.findOne({
                    where: {
                        id_usuario,
                        tipo: 'especial',
                        fecha: getLast24HoursRange()
                    },
                    order: [['fecha', 'DESC']]
                });
                
                if (lastClaim) {
                    canClaimMore = false;
                    lastClaimTimestamp = lastClaim.fecha;
                }
            }
        }

        // Si se provee usuario, buscar los reclamos de las últimas 24h para estas misiones
        const misionesConEstado = await Promise.all(misiones.map(async (mision) => {
            let claimStatus = null;
            if (id_usuario) {
                const reclamo = await MisionReclamo.findOne({
                    where: {
                        id_usuario,
                        id_mision: mision.id_mision,
                        tipo: 'especial',
                        fecha: getLast24HoursRange()
                    },
                    order: [['fecha', 'DESC']]
                });
                if (reclamo) {
                    claimStatus = reclamo.estado;
                }
            }
            return {
                ...mision.toJSON(),
                claimStatus
            };
        }));

        res.json({
            success: true,
            data: misionesConEstado,
            limits: {
                canClaimMore,
                lastClaimTimestamp,
                isVip
            }
        });

    } catch (error) {
        console.error("Error al obtener misiones especiales:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * CRUD Misiones Especiales (Admin)
 */
const listarMisionesAdmin = async (req, res) => {
    try {
        const misiones = await MisionEspecial.findAll({
            order: [['fecha_creacion', 'DESC']]
        });
        res.json({ success: true, data: misiones });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const crearMisionAdmin = async (req, res) => {
    try {
        const { titulo, descripcion, emoji, valor, tipo_respuesta, opciones, activa } = req.body;
        const mision = await MisionEspecial.create({
            titulo, descripcion, emoji, valor, tipo_respuesta, opciones, activa
        });
        res.json({ success: true, data: mision });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const actualizarMisionAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, descripcion, emoji, valor, tipo_respuesta, opciones, activa } = req.body;
        const mision = await MisionEspecial.findByPk(id);
        if (!mision) return res.status(404).json({ success: false, error: "Misión no encontrada" });

        await mision.update({
            titulo, descripcion, emoji, valor, tipo_respuesta, opciones, activa
        });
        res.json({ success: true, data: mision });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const eliminarMisionAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const mision = await MisionEspecial.findByPk(id);
        if (!mision) return res.status(404).json({ success: false, error: "Misión no encontrada" });
        await mision.destroy();
        res.json({ success: true, message: "Misión eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Enviar reclamo de misión especial
 */
const reclamarMisionEspecial = async (req, res) => {
    try {
        const id_usuario = req.user?.id_usuario || req.body.id_usuario;
        const { id_mision, respuesta } = req.body;

        if (!id_usuario || !id_mision) {
            return res.status(400).json({ success: false, error: "Faltan datos obligatorios" });
        }

        // 1. Verificar si la misión existe y está activa
        const mision = await MisionEspecial.findByPk(id_mision);
        if (!mision || !mision.activa) {
            return res.status(400).json({ success: false, error: "Misión no disponible" });
        }

        // 2. Validar membresía y límite de 24 horas
        const isVip = await hasActiveMembership(id_usuario);
        if (!isVip) {
            const lastClaim = await MisionReclamo.findOne({
                where: {
                    id_usuario,
                    tipo: 'especial',
                    fecha: getLast24HoursRange()
                }
            });

            if (lastClaim) {
                const lastDate = new Date(lastClaim.fecha);
                const nextDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
                const hoursLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60));
                
                return res.status(403).json({
                    success: false,
                    error: `Límite alcanzado. Como usuario gratuito solo puedes realizar 1 misión cada 24 horas. Podrás realizar otra en aproximadamente ${hoursLeft} horas.`,
                    nextAvailable: nextDate
                });
            }
        }

        // 3. Verificar si ya existe reclamo de esta MISMA misión hoy (para evitar duplicados exactos)
        const reclamoExistente = await MisionReclamo.findOne({
            where: {
                id_usuario,
                id_mision,
                tipo: 'especial',
                estado: ['pendiente', 'aprobado'],
                fecha: getTodayRange()
            }
        });

        if (reclamoExistente) {
            return res.status(400).json({
                success: false,
                error: "Ya tienes un reclamo registrado hoy para esta misión"
            });
        }

        // 4. Crear reclamo
        const reclamo = await MisionReclamo.create({
            id_usuario,
            id_mision,
            tipo: 'especial',
            estado: 'pendiente',
            monto: mision.valor,
            respuesta: respuesta || '',
            fecha: new Date()
        });

        // Enviar notificación de misión especial enviada
        try {
            await NotificacionDestinatario.notificar({
                tipo: 'misiones',
                titulo: 'Misión especial enviada',
                id_usuario: id_usuario,
                creado_por: 'Sistema'
            });
        } catch (notifyError) {
            console.error('Error al enviar notificación de misión especial enviada:', notifyError);
        }

        res.json({
            success: true,
            message: "Reclamo enviado correctamente y pendiente de aprobación",
            data: reclamo
        });

    } catch (error) {
        console.error("Error al reclamar misión especial:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener todos los reclamos registrados (Admin)
 */
const getReclamos = async (req, res) => {
    try {
        const { tipo, estado } = req.query;
        const where = {};
        if (tipo) where.tipo = tipo;
        if (estado) where.estado = estado;

        const reclamos = await MisionReclamo.findAll({
            where,
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id_usuario', 'nombre', 'email', 'imagen_url']
                },
                {
                    model: MisionEspecial,
                    as: 'mision'
                }
            ],
            order: [['fecha', 'DESC']]
        });

        res.json({ success: true, data: reclamos });

    } catch (error) {
        console.error("Error al obtener reclamos:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Procesar (aprobar/rechazar) reclamo (Admin)
 */
const procesarReclamo = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body; // 'aprobado' o 'rechazado'

        if (!['aprobado', 'rechazado'].includes(estado)) {
            return res.status(400).json({ success: false, error: "Estado no válido. Debe ser aprobado o rechazado" });
        }

        const reclamo = await MisionReclamo.findByPk(id, {
            include: [{ model: MisionEspecial, as: 'mision' }]
        });
        if (!reclamo) {
            return res.status(404).json({ success: false, error: "Reclamo no encontrado" });
        }

        if (reclamo.estado !== 'pendiente') {
            return res.status(400).json({ success: false, error: "El reclamo ya fue procesado anteriormente" });
        }

        let montoOtorgado = 0;
        // Si se aprueba, acreditar el saldo
        if (estado === 'aprobado') {
            // Determine monto a otorgar
            if (reclamo.tipo === 'especial' && reclamo.mision && !reclamo.mision.activa && reclamo.mision.total_ganadores) {
                // Mission is already finalized, give proportional share
                montoOtorgado = parseFloat((parseFloat(reclamo.mision.valor) / reclamo.mision.total_ganadores).toFixed(2));
            } else {
                // Otherwise, give full amount (mission still active or not finalized yet)
                montoOtorgado = parseFloat(reclamo.monto);
            }
            
            const creditoExistente = await CreditoUsuario.findOne({ where: { id_usuario: reclamo.id_usuario } });
            let nuevoMonto = montoOtorgado;
            if (creditoExistente) {
                nuevoMonto += parseFloat(creditoExistente.monto_credito);
            }

            await CreditoUsuario.upsert({
                id_usuario: reclamo.id_usuario,
                monto_credito: parseFloat(nuevoMonto.toFixed(2)),
                fecha: new Date()
            });
        }

        await reclamo.update({ 
            estado,
            monto_otorgado: estado === 'aprobado' ? montoOtorgado : 0
        });

        // Enviar notificación según estado
        try {
            if (estado === 'aprobado') {
                await NotificacionDestinatario.notificar({
                    tipo: 'misiones',
                    titulo: `Misión especial aprobada ⚡ +$${montoOtorgado.toFixed(2)}`,
                    id_usuario: reclamo.id_usuario,
                    creado_por: 'Sistema'
                });
            } else {
                await NotificacionDestinatario.notificar({
                    tipo: 'misiones',
                    titulo: 'Misión especial rechazada',
                    id_usuario: reclamo.id_usuario,
                    creado_por: 'Sistema'
                });
            }
        } catch (notifyError) {
            console.error('Error al enviar notificación de procesamiento de misión:', notifyError);
        }

        res.json({
            success: true,
            message: `Reclamo ${estado === 'aprobado' ? 'aprobado y saldo acreditado' : 'rechazado'} correctamente`,
            data: reclamo
        });

    } catch (error) {
        console.error("Error al procesar reclamo:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener historial de reclamos de misiones de un usuario (para el modal de historial)
 */
const getHistorialUsuario = async (req, res) => {
    try {
        const id_usuario = req.params.id_usuario || req.user?.id_usuario;
        if (!id_usuario) {
            return res.status(400).json({ success: false, error: "Falta id_usuario" });
        }

        const { limit = 20, offset = 0 } = req.query;

        const reclamos = await MisionReclamo.findAll({
            where: { 
                id_usuario,
                [Op.or]: [
                    { tipo: 'auto' }, // Mostrar siempre misiones diarias
                    { tipo: 'especial', estado: 'aprobado' } // Solo mostrar especiales si acertaron (aprobado)
                ]
            },
            include: [{
                model: MisionEspecial,
                as: 'mision'
            }],
            order: [['fecha', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // First collect all unique mission IDs for special missions
        const misionIds = reclamos
            .filter(r => r.tipo === 'especial' && r.id_mision)
            .map(r => r.id_mision);
        
        // Create a map to store total winners for each mission
        const totalGanadoresPorMision = {};
        
        // If there are any mission IDs, calculate the number of winners for each
        if (misionIds.length > 0) {
            const winnersCounts = await MisionReclamo.findAll({
                attributes: [
                    'id_mision',
                    [sequelize.fn('COUNT', sequelize.col('id_reclamo')), 'count']
                ],
                where: {
                    id_mision: { [Op.in]: misionIds },
                    estado: 'aprobado',
                    tipo: 'especial'
                },
                group: ['id_mision'],
                raw: true
            });
            
            // Populate the map
            winnersCounts.forEach(w => {
                totalGanadoresPorMision[w.id_mision] = parseInt(w.count);
            });
        }

        // Format to match interaction history shape
        const data = reclamos.map(r => {
            let totalGanadores = r.mision?.total_ganadores;
            // If the mission doesn't have total_ganadores, use the calculated value
            if (r.tipo === 'especial' && totalGanadores === null && totalGanadoresPorMision[r.id_mision] !== undefined) {
                totalGanadores = totalGanadoresPorMision[r.id_mision];
            }
            
            return {
                id_unico: `mision_${r.id_reclamo}`,
                _isMision: true,
                tipo: r.tipo === 'auto' ? 'mision_auto' : 'mision_especial',
                id_mision: r.id_mision,
                descripcion: r.tipo === 'auto' ? 'Misión Diaria' : (r.mision?.titulo || 'Misión Especial'),
                monto_ganado: r.estado === 'aprobado' ? parseFloat(r.monto_otorgado || r.monto) : 0,
                monto: parseFloat(r.monto),
                monto_otorgado: parseFloat(r.monto_otorgado || r.monto),
                total_ganadores_mision: totalGanadores,
                estado: r.estado,
                fecha: r.fecha,
                respuesta: r.respuesta,
                publicacion: null,
                anunciante: null
            };
        });

        res.json({ success: true, data });

    } catch (error) {
        console.error("Error al obtener historial de misiones:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Finalizar una misión de selección premiando a los que acertaron
 */
const finalizarMisionSeleccion = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id_mision, respuesta_correcta } = req.body;

        if (!id_mision || !respuesta_correcta) {
            await transaction.rollback();
            return res.status(400).json({ success: false, error: "Faltan datos obligatorios" });
        }

        // 1. Obtener la misión para ver el valor total
        const mision = await MisionEspecial.findByPk(id_mision, { transaction });
        if (!mision) {
            await transaction.rollback();
            return res.status(404).json({ success: false, error: "Misión no encontrada" });
        }

        // 2. Obtener todos los reclamos pendientes para esta misión
        const reclamos = await MisionReclamo.findAll({
            where: {
                id_mision,
                tipo: 'especial',
                estado: 'pendiente'
            },
            include: [{
                model: Usuario,
                as: 'usuario',
                attributes: ['id_usuario', 'nombre', 'email', 'imagen_url']
            }],
            transaction
        });

        // 3. Filtrar ganadores (quienes acertaron)
        const ganadores = reclamos.filter(r => r.respuesta === respuesta_correcta);
        const totalGanadores = ganadores.length;

        // 4. Calcular recompensa proporcional
        const valorTotal = parseFloat(mision.valor);
        let recompensaPorGanador = 0;
        if (totalGanadores > 0) {
            recompensaPorGanador = parseFloat((valorTotal / totalGanadores).toFixed(2));
        }

        let aprobados = 0;
        let rechazados = 0;
        const ganadoresData = [];

        // 5. Procesar cada reclamo
        for (const reclamo of reclamos) {
            const esCorrecto = reclamo.respuesta === respuesta_correcta;
            const nuevoEstado = esCorrecto ? 'aprobado' : 'rechazado';

            if (esCorrecto) {
                // Acreditar saldo con la porción proporcional
                const creditoExistente = await CreditoUsuario.findOne({ 
                    where: { id_usuario: reclamo.id_usuario },
                    transaction 
                });
                
                let nuevoMonto = recompensaPorGanador;
                if (creditoExistente) {
                    nuevoMonto += parseFloat(creditoExistente.monto_credito);
                }

                await CreditoUsuario.upsert({
                    id_usuario: reclamo.id_usuario,
                    monto_credito: parseFloat(nuevoMonto.toFixed(2)),
                    fecha: new Date()
                }, { transaction });

                // Guardar el monto otorgado en el reclamo
                await reclamo.update({ 
                    estado: nuevoEstado,
                    monto_otorgado: recompensaPorGanador 
                }, { transaction });

                ganadoresData.push({
                    id_reclamo: reclamo.id_reclamo,
                    id_usuario: reclamo.id_usuario,
                    usuario: reclamo.usuario,
                    monto: recompensaPorGanador,
                    respuesta: reclamo.respuesta
                });

                aprobados++;
            } else {
                await reclamo.update({ 
                    estado: nuevoEstado,
                    monto_otorgado: 0
                }, { transaction });
                rechazados++;
            }

            // Enviar notificación a cada usuario
            try {
                if (nuevoEstado === 'aprobado') {
                    await NotificacionDestinatario.notificar({
                        tipo: 'misiones',
                        titulo: `Misión especial aprobada ⚡ +$${recompensaPorGanador.toFixed(2)}`,
                        id_usuario: reclamo.id_usuario,
                        creado_por: 'Sistema'
                    });
                } else {
                    await NotificacionDestinatario.notificar({
                        tipo: 'misiones',
                        titulo: 'Misión especial rechazada',
                        id_usuario: reclamo.id_usuario,
                        creado_por: 'Sistema'
                    });
                }
            } catch (notifyError) {
                console.error('Error al enviar notificación de finalización de misión:', notifyError);
            }
        }

        // 6. Desactivar la misión una vez finalizada y guardar la respuesta correcta
        await MisionEspecial.update(
            { 
                activa: false,
                respuesta_correcta: respuesta_correcta,
                total_ganadores: totalGanadores
            },
            { where: { id_mision }, transaction }
        );

        await transaction.commit();

        res.json({
            success: true,
            message: `Misión finalizada. ${aprobados} usuarios premiados, ${rechazados} reclamos rechazados.`,
            data: { 
                aprobados, 
                rechazados,
                totalGanadores,
                valorTotal,
                recompensaPorGanador,
                ganadores: ganadoresData
            }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Error al finalizar misión de selección:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener estadísticas de una misión (Admin) con paginación
 */
const getMisionStats = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 10, offset = 0 } = req.query;
        
        const mision = await MisionEspecial.findByPk(id);
        if (!mision) return res.status(404).json({ success: false, error: "Misión no encontrada" });

        // 1. Obtener conteo total para estadísticas globales (sin paginación)
        const totalReclamos = await MisionReclamo.findAll({
            where: { id_mision: id, tipo: 'especial' },
            attributes: ['respuesta', 'estado']
        });

        // 2. Calcular estadísticas básicas globales
        const stats = {
            total: totalReclamos.length,
            respuestas: {},
            correctas: 0,
            incorrectas: 0,
            pendientes: 0
        };

        totalReclamos.forEach(r => {
            const resp = r.respuesta || 'Sin respuesta';
            stats.respuestas[resp] = (stats.respuestas[resp] || 0) + 1;
            
            if (r.estado === 'aprobado') {
                stats.correctas++;
            } else if (r.estado === 'rechazado') {
                stats.incorrectas++;
            } else {
                stats.pendientes++;
            }
        });

        // 3. Obtener reclamos paginados para la lista
        const { count, rows: reclamos } = await MisionReclamo.findAndCountAll({
            where: { id_mision: id, tipo: 'especial' },
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id_usuario', 'nombre', 'email', 'imagen_url']
                }
            ],
            order: [['fecha', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: {
                mision,
                stats,
                reclamos,
                total: count
            }
        });

    } catch (error) {
        console.error("Error al obtener estadísticas de misión:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Procesar múltiples reclamos (Admin)
 */
const procesarReclamosBulk = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { ids, estado } = req.body; // ids: array de ids, estado: 'aprobado' o 'rechazado'

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: "Faltan IDs de reclamos" });
        }

        if (!['aprobado', 'rechazado'].includes(estado)) {
            return res.status(400).json({ success: false, error: "Estado no válido" });
        }

        const reclamos = await MisionReclamo.findAll({
            where: { id_reclamo: ids, estado: 'pendiente' },
            include: [{ model: MisionEspecial, as: 'mision' }],
            transaction
        });

        // Get mission details from first claim to determine monto_otorgado
        let mission = null;
        let montoOtorgadoPerClaim = null;
        if (reclamos.length > 0 && reclamos[0].tipo === 'especial') {
            mission = reclamos[0].mision;
            if (mission && !mission.activa && mission.total_ganadores) {
                montoOtorgadoPerClaim = parseFloat((parseFloat(mission.valor) / mission.total_ganadores).toFixed(2));
            }
        }

        let procesados = 0;

        for (const reclamo of reclamos) {
            let montoOtorgado = 0;
            
            if (estado === 'aprobado') {
                // Determine amount
                if (montoOtorgadoPerClaim !== null) {
                    montoOtorgado = montoOtorgadoPerClaim;
                } else {
                    montoOtorgado = parseFloat(reclamo.monto);
                }
                
                const creditoExistente = await CreditoUsuario.findOne({ 
                    where: { id_usuario: reclamo.id_usuario },
                    transaction 
                });
                
                let nuevoMonto = montoOtorgado;
                if (creditoExistente) {
                    nuevoMonto += parseFloat(creditoExistente.monto_credito);
                }

                await CreditoUsuario.upsert({
                    id_usuario: reclamo.id_usuario,
                    monto_credito: parseFloat(nuevoMonto.toFixed(2)),
                    fecha: new Date()
                }, { transaction });
            }

            await reclamo.update({ 
                estado, 
                monto_otorgado: estado === 'aprobado' ? montoOtorgado : 0 
            }, { transaction });
            procesados++;
        }

        await transaction.commit();

        res.json({
            success: true,
            message: `${procesados} reclamos procesados como ${estado}`,
            data: { procesados }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Error en procesamiento masivo:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener distribución de ganadores de una misión especial
 */
const getMisionGanadores = async (req, res) => {
    try {
        const { id } = req.params;

        const mision = await MisionEspecial.findByPk(id);
        if (!mision) {
            return res.status(404).json({ success: false, error: "Misión no encontrada" });
        }

        const reclamos = await MisionReclamo.findAll({
            where: { id_mision: id, tipo: 'especial', estado: ['aprobado', 'rechazado'] },
            include: [{
                model: Usuario,
                as: 'usuario',
                attributes: ['id_usuario', 'nombre', 'email', 'imagen_url']
            }],
            order: [['fecha', 'DESC']]
        });

        const ganadores = reclamos.filter(r => r.estado === 'aprobado');
        const perdedores = reclamos.filter(r => r.estado === 'rechazado');

        // Calcular estadísticas
        const valorTotal = parseFloat(mision.valor);
        const totalGanadores = ganadores.length;
        const recompensaPorGanador = totalGanadores > 0 ? parseFloat((valorTotal / totalGanadores).toFixed(2)) : 0;

        // Formatear datos de ganadores con montos otorgados
        const ganadoresData = ganadores.map(g => ({
            id_reclamo: g.id_reclamo,
            id_usuario: g.id_usuario,
            usuario: g.usuario,
            monto_base: parseFloat(g.monto),
            monto_otorgado: parseFloat(g.monto_otorgado || recompensaPorGanador),
            respuesta: g.respuesta,
            fecha: g.fecha
        }));

        res.json({
            success: true,
            data: {
                mision,
                valorTotal,
                totalGanadores,
                totalPerdedores: perdedores.length,
                recompensaPorGanador,
                ganadores: ganadoresData,
                perdedores: perdedores.map(p => ({
                    id_reclamo: p.id_reclamo,
                    id_usuario: p.id_usuario,
                    usuario: p.usuario,
                    respuesta: p.respuesta,
                    fecha: p.fecha
                }))
            }
        });

    } catch (error) {
        console.error("Error al obtener ganadores de la misión:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

module.exports = {
    getMisionesProgress,
    reclamarMisionAuto,
    getMisionesEspeciales,
    listarMisionesAdmin,
    crearMisionAdmin,
    actualizarMisionAdmin,
    eliminarMisionAdmin,
    reclamarMisionEspecial,
    getReclamos,
    procesarReclamo,
    getHistorialUsuario,
    finalizarMisionSeleccion,
    getMisionStats,
    procesarReclamosBulk,
    getMisionGanadores
};
