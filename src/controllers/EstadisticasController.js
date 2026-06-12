const { sequelize } = require("../config/database");
const { Op, fn, col, literal } = require("sequelize");
const Usuario = require("../models/usuariosModel");
const Membresia = require("../models/membresiaModel");
const Publicacion = require("../models/publicacionesModel");
const Interaccion = require("../models/InteraccionModel");
const Retiro = require("../models/retiroModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");
const Ciudad = require("../models/ciudadesModel");
const RedNiveles = require("../models/redNivelesModel");
const Rol = require("../models/rolesModel");
const Config = require("../models/configModel");

// Función auxiliar para extraer edad desde el DNI
const obtenerEdadDesdeIdentidad = (identidad) => {
    if (!identidad) return null;
    const idLimpia = identidad.replace(/-/g, '');
    if (idLimpia.length < 8) return null;
    const anioStr = idLimpia.substring(4, 8);
    const anioNacimiento = parseInt(anioStr);
    if (isNaN(anioNacimiento)) return null;
    const anioActual = new Date().getFullYear();
    return anioActual - anioNacimiento;
};

/**
 * Obtener estadísticas globales para administradores
 */
const getGlobalStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // 0. Obtener IDs de usuarios administradores para excluirlos de estadísticas de red
        const adminRoles = await Rol.findAll({
            where: {
                nombre_rol: { [Op.in]: ['admin', 'sa', 'Admin'] }
            },
            attributes: ['id_rol']
        });
        const adminRoleIds = adminRoles.map(r => r.id_rol);
        
        const adminUsers = await Usuario.findAll({
            where: {
                id_rol: { [Op.in]: adminRoleIds }
            },
            attributes: ['id_usuario']
        });
        const adminIds = adminUsers.map(u => u.id_usuario);

        // Configurar rango de fechas
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const dateFilter = {
            fecha: { [Op.between]: [start, end] }
        };

        const dateFilterUsuario = {
            fecha_registro: { [Op.between]: [start, end] }
        };

        const diasGraciaConfigObj = await Config.findOne({ where: { tipo_config: 'dias_gracia_membresia' }, attributes: ['valor'] });
        const diasGracia = parseInt(diasGraciaConfigObj?.valor || '5', 10);

        // 1. KPIs (Conteos Totales y por Periodo)
        const [
            totalUsuarios,
            totalMembresiasActivas,
            totalMembresiasEnGracia,
            totalMembresiasVencidas,
            totalPublicacionesActivas,
            totalPublicacionesFinalizadas,
            ingresosMembresias,
            ingresosPublicaciones,
            creditosCirculante
        ] = await Promise.all([
            Usuario.count({ 
                where: { 
                    ...dateFilterUsuario,
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                } 
            }),
            Membresia.count({ 
                where: { 
                    estado: 'activa', 
                    ...dateFilter,
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                } 
            }),
            // Membresías en período de gracia: estado 'activa', pero fecha de vencimiento (fecha + 30 días) ya pasó, y la fecha actual está dentro de (fecha de vencimiento + diasGracia)
            Membresia.count({
                where: {
                    estado: 'activa',
                    fecha: {
                        [Op.lte]: sequelize.literal(`DATE_SUB(CURDATE(), INTERVAL 30 DAY)`) // Fecha de inicio hace más de 30 días
                    },
                    [Op.and]: sequelize.literal(`DATE_ADD(fecha, INTERVAL 30 DAY) <= CURDATE() AND DATE_ADD(fecha, INTERVAL (30 + ${diasGracia}) DAY) >= CURDATE()`),
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                }
            }),
            // Membresías realmente vencidas: estado 'vencida' O estado 'activa' pero ya fuera del período de gracia
            Membresia.count({
                where: {
                    [Op.or]: [
                        { estado: 'vencida' },
                        {
                            estado: 'activa',
                            [Op.and]: sequelize.literal(`DATE_ADD(fecha, INTERVAL (30 + ${diasGracia}) DAY) < CURDATE()`)
                        }
                    ],
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                }
            }),
            Publicacion.count({ 
                where: { 
                    estado: 'activa', 
                    presupuesto_restante: { [Op.gt]: 0.00 },
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                } 
            }),
            Publicacion.count({ 
                where: { 
                    presupuesto_restante: { [Op.lte]: 0.00 },
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                } 
            }),
            Membresia.sum('monto', { 
                where: { 
                    estado: 'activa', 
                    ...dateFilter,
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                } 
            }),
            Publicacion.sum('presupuesto', { 
                where: { 
                    estado: 'activa', 
                    ...dateFilter,
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                } 
            }),
            CreditoUsuario.sum('monto_credito')
        ]);

        // 2. Rankings
        const [
            topVistas,
            topLikes,
            topShares,
            topWhatsapp,
            topWeb,
            topSaldos,
            topPubsUsuarios,
            topReferidos
        ] = await Promise.all([
            // Top 5 Vistas
            Publicacion.findAll({
                limit: 5,
                order: [['vistas', 'DESC']],
                attributes: ['id_publicacion', 'content', 'vistas'],
                include: [{ model: Usuario, as: 'usuario', attributes: ['nombre'] }]
            }),
            // Top 5 Likes
            Publicacion.findAll({
                limit: 5,
                order: [['likes', 'DESC']],
                attributes: ['id_publicacion', 'content', 'likes'],
                include: [{ model: Usuario, as: 'usuario', attributes: ['nombre'] }]
            }),
            // Top 5 Shares (Desde Interacciones)
            Interaccion.findAll({
                where: { tipo: 'share' },
                attributes: ['id_publicacion', [fn('COUNT', col('id_interaccion')), 'total']],
                group: ['id_publicacion'],
                order: [[literal('total'), 'DESC']],
                limit: 5,
                include: [{ 
                    model: Publicacion, 
                    as: 'publicacion', 
                    attributes: ['content'],
                    include: [{ model: Usuario, as: 'usuario', attributes: ['nombre'] }]
                }]
            }),
            // Top 5 WhatsApp
            Interaccion.findAll({
                where: { tipo: 'visita_whatsapp' },
                attributes: ['id_publicacion', [fn('COUNT', col('id_interaccion')), 'total']],
                group: ['id_publicacion'],
                order: [[literal('total'), 'DESC']],
                limit: 5,
                include: [{ 
                    model: Publicacion, 
                    as: 'publicacion', 
                    attributes: ['content'],
                    include: [{ model: Usuario, as: 'usuario', attributes: ['nombre'] }]
                }]
            }),
            // Top 5 Web
            Interaccion.findAll({
                where: { tipo: 'visita_web' },
                attributes: ['id_publicacion', [fn('COUNT', col('id_interaccion')), 'total']],
                group: ['id_publicacion'],
                order: [[literal('total'), 'DESC']],
                limit: 5,
                include: [{ 
                    model: Publicacion, 
                    as: 'publicacion', 
                    attributes: ['content'],
                    include: [{ model: Usuario, as: 'usuario', attributes: ['nombre'] }]
                }]
            }),
            // Top 10 Saldos
            CreditoUsuario.findAll({
                limit: 10,
                where: { id_usuario: { [Op.notIn]: adminIds } },
                order: [['monto_credito', 'DESC']],
                include: [{ model: Usuario, as: 'usuario', attributes: ['nombre', 'email'] }]
            }),
            // Top 10 Usuarios con más publicaciones
            Publicacion.findAll({
                attributes: ['id_usuario', [fn('COUNT', col('Publicacion.id_publicacion')), 'total']],
                group: ['Publicacion.id_usuario'],
                order: [[literal('total'), 'DESC']],
                limit: 10,
                include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre', 'email'] }]
            }),
            // Top 10 Usuarios con más referidos
            RedNiveles.findAll({
                attributes: ['id_patrocinador', [fn('COUNT', col('RedNiveles.id_usuario')), 'total']],
                where: { id_patrocinador: { [Op.notIn]: adminIds } },
                group: ['RedNiveles.id_patrocinador'],
                order: [[literal('total'), 'DESC']],
                limit: 10,
                include: [{ model: Usuario, as: 'patrocinador', attributes: ['id_usuario', 'nombre', 'email'] }]
            })
        ]);

        // 3. Gráficos
        const [
            ingresosMensuales,
            crecimientoUsuarios,
            crecimientoPublicaciones,
            distribucionCiudades,
            todosUsuarios
        ] = await Promise.all([
            // Ingresos mensuales (últimos 6 meses)
            Membresia.findAll({
                attributes: [
                    [fn('DATE_FORMAT', col('fecha'), '%Y-%m'), 'mes'],
                    [fn('SUM', col('monto')), 'total']
                ],
                where: { estado: 'activa' },
                group: ['mes'],
                order: [['mes', 'ASC']],
                limit: 6,
                raw: true
            }),
            // Crecimiento usuarios (diario en el rango seleccionado)
            Usuario.findAll({
                attributes: [
                    [fn('DATE_FORMAT', col('fecha_registro'), '%Y-%m-%d'), 'fecha'],
                    [fn('COUNT', col('id_usuario')), 'total']
                ],
                where: dateFilterUsuario,
                group: [fn('DATE_FORMAT', col('fecha_registro'), '%Y-%m-%d')],
                order: [[fn('DATE_FORMAT', col('fecha_registro'), '%Y-%m-%d'), 'ASC']],
                raw: true
            }),
            // Crecimiento publicaciones (diario en el rango seleccionado)
            Publicacion.findAll({
                attributes: [
                    [fn('DATE_FORMAT', col('fecha'), '%Y-%m-%d'), 'fecha'],
                    [fn('COUNT', col('id_publicacion')), 'total']
                ],
                where: dateFilter,
                group: [fn('DATE_FORMAT', col('fecha'), '%Y-%m-%d')],
                order: [[fn('DATE_FORMAT', col('fecha'), '%Y-%m-%d'), 'ASC']],
                raw: true
            }),
            // Distribución por ciudades
            Usuario.findAll({
                attributes: [
                    [col('Usuario.id_ciudad'), 'id_ciudad'],
                    [fn('COUNT', col('id_usuario')), 'total']
                ],
                include: [{ model: Ciudad, as: 'ciudad', attributes: ['nombre_ciudad'] }],
                group: ['Usuario.id_ciudad', 'ciudad.nombre_ciudad'],
                raw: true,
                nest: true
            }),
            // Datos para demografía (género y edad)
            Usuario.findAll({
                attributes: ['genero', 'identidad'],
                raw: true
            })
        ]);

        // Procesar demografía de usuarios
        const demografia = {
            generos: { masculino: 0, femenino: 0 },
            edades: { '13-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0, 'Desconocido': 0 }
        };

        todosUsuarios.forEach(u => {
            // Género
            const gen = u.genero || 'desconocido';
            if (demografia.generos[gen] !== undefined) demografia.generos[gen]++;
            else demografia.generos.desconocido++;

            // Edad
            const edad = obtenerEdadDesdeIdentidad(u.identidad);
            if (edad === null) demografia.edades['Desconocido']++;
            else if (edad < 18) demografia.edades['13-17']++;
            else if (edad <= 24) demografia.edades['18-24']++;
            else if (edad <= 34) demografia.edades['25-34']++;
            else if (edad <= 44) demografia.edades['35-44']++;
            else if (edad <= 54) demografia.edades['45-54']++;
            else demografia.edades['55+']++;
        });

        res.json({
            success: true,
            data: {
                kpis: {
                    usuarios: totalUsuarios || 0,
                    membresiasActivas: totalMembresiasActivas || 0,
                    periodoGracia: totalMembresiasEnGracia || 0,
                    membresiasVencidas: totalMembresiasVencidas || 0,
                    publicacionesActivas: totalPublicacionesActivas || 0,
                    publicacionesVencidas: totalPublicacionesFinalizadas || 0,
                    ingresosMembresias: parseFloat(ingresosMembresias || 0),
                    ingresosPublicaciones: parseFloat(ingresosPublicaciones || 0),
                    ingresosTotales: parseFloat(ingresosMembresias || 0) + parseFloat(ingresosPublicaciones || 0),
                    creditosCirculante: parseFloat(creditosCirculante || 0)
                },
                rankings: {
                    vistas: topVistas,
                    likes: topLikes,
                    shares: topShares,
                    whatsapp: topWhatsapp,
                    web: topWeb,
                    saldos: topSaldos,
                    masPublicaciones: topPubsUsuarios,
                    masReferidos: topReferidos
                },
                charts: {
                    ingresosMensuales,
                    crecimientoUsuarios,
                    crecimientoPublicaciones,
                    distribucionCiudades,
                    demografia
                }
            }
        });

    } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        res.status(500).json({ success: false, error: "Error al obtener estadísticas" });
    }
};

/**
 * Obtener detalles para los modales de KPIs
 */
const getKpiDetails = async (req, res) => {
    try {
        const { type, page = 1, limit = 10, search = '', startDate, endDate } = req.query;
        const offset = (page - 1) * limit;

        // Obtener IDs de usuarios administradores
        const adminRoles = await Rol.findAll({
            where: {
                nombre_rol: { [Op.in]: ['admin', 'sa', 'Admin'] }
            },
            attributes: ['id_rol']
        });
        const adminRoleIds = adminRoles.map(r => r.id_rol);
        
        const adminUsers = await Usuario.findAll({
            where: {
                id_rol: { [Op.in]: adminRoleIds }
            },
            attributes: ['id_usuario']
        });
        const adminIds = adminUsers.map(u => u.id_usuario);

        const diasGraciaConfigObj = await Config.findOne({ where: { tipo_config: 'dias_gracia_membresia' }, attributes: ['valor'] });
        const diasGracia = parseInt(diasGraciaConfigObj?.valor || '5', 10);

        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        let model;
        let where = {};
        let include = [];
        let attributes = [];
        let customOrder = null;

        const dateFilter = { [Op.between]: [start, end] };

        switch (type) {
            case 'usuarios':
                model = Usuario;
                where = {
                    fecha_registro: dateFilter,
                    [Op.or]: [
                        { nombre: { [Op.like]: `%${search}%` } },
                        { email: { [Op.like]: `%${search}%` } }
                    ],
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                };
                attributes = ['id_usuario', 'nombre', 'email', ['fecha_registro', 'fecha_display']];
                break;
            case 'membresiasActivas':
            case 'ingresosMembresias':
                model = Membresia;
                where = {
                    estado: 'activa',
                    fecha: dateFilter,
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                };
                attributes = ['id_membresia', 'id_usuario', ['monto', 'monto_ganado'], 'estado', ['fecha', 'fecha_display']];
                include = [{
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['nombre', 'email'],
                    required: true,
                    where: search ? {
                        [Op.or]: [
                            { nombre: { [Op.like]: `%${search}%` } },
                            { email: { [Op.like]: `%${search}%` } }
                        ]
                    } : {}
                }];
                break;
            case 'periodoGracia':
                model = Membresia;
                where = {
                    estado: 'activa',
                    fecha: dateFilter,
                    [Op.and]: sequelize.literal(`DATE_ADD(fecha, INTERVAL 30 DAY) <= CURDATE() AND DATE_ADD(fecha, INTERVAL (30 + ${diasGracia}) DAY) >= CURDATE()`),
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                };
                attributes = [
                    'id_membresia', 
                    'id_usuario', 
                    'estado', 
                    [sequelize.literal(`DATE_ADD(fecha, INTERVAL (30 + ${diasGracia}) DAY)`), 'fecha_display'],
                    [sequelize.literal("'vencimiento'"), 'tipo_fecha'] // Indicador para el frontend
                ];
                customOrder = [['fecha', 'ASC']]; // Ordenar por la que vence más pronto
                include = [{
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['nombre', 'email'],
                    required: true,
                    where: search ? {
                        [Op.or]: [
                            { nombre: { [Op.like]: `%${search}%` } },
                            { email: { [Op.like]: `%${search}%` } }
                        ]
                    } : {}
                }];
                break;
            case 'membresiasVencidas':
                model = Membresia;
                where = {
                    fecha: dateFilter,
                    [Op.or]: [
                        { estado: 'vencida' },
                        {
                            estado: 'activa',
                            [Op.and]: sequelize.literal(`DATE_ADD(fecha, INTERVAL (30 + ${diasGracia}) DAY) < CURDATE()`)
                        }
                    ],
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                };
                attributes = [
                    'id_membresia', 
                    'id_usuario', 
                    'estado', 
                    [sequelize.literal(`DATE_ADD(fecha, INTERVAL (30 + ${diasGracia}) DAY)`), 'fecha_display'],
                    [sequelize.literal("'vencimiento'"), 'tipo_fecha'] // Indicador para el frontend
                ];
                include = [{
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['nombre', 'email'],
                    required: true,
                    where: search ? {
                        [Op.or]: [
                            { nombre: { [Op.like]: `%${search}%` } },
                            { email: { [Op.like]: `%${search}%` } }
                        ]
                    } : {}
                }];
                break;
            case 'publicacionesActivas':
                model = Publicacion;
                where = {
                    estado: 'activa',
                    presupuesto_restante: { [Op.gt]: 0.00 },
                    content: { [Op.like]: `%${search}%` },
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                };
                attributes = ['id_publicacion', 'content', ['presupuesto_restante', 'monto_ganado'], 'estado', ['fecha', 'fecha_display']];
                include = [{ model: Usuario, as: 'usuario', attributes: ['nombre'] }];
                break;
            case 'ingresosPublicaciones':
                model = Publicacion;
                where = {
                    estado: 'activa',
                    presupuesto_restante: { [Op.gt]: 0.00 },
                    content: { [Op.like]: `%${search}%` },
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                };
                attributes = ['id_publicacion', 'content', ['presupuesto_restante', 'monto_ganado'], 'estado', ['fecha', 'fecha_display']];
                include = [{ model: Usuario, as: 'usuario', attributes: ['nombre'] }];
                break;
            case 'ingresosTotales':
                // Para ingresos totales mostramos una combinación (por ahora priorizamos membresías)
                model = Membresia;
                where = {
                    estado: 'activa',
                    fecha: dateFilter,
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                };
                attributes = ['id_membresia', 'id_usuario', ['monto', 'monto_ganado'], 'estado', ['fecha', 'fecha_display']];
                include = [{ 
                    model: Usuario, 
                    as: 'usuario', 
                    attributes: ['nombre', 'email'], 
                    required: true,
                    where: search ? { 
                        [Op.or]: [
                            { nombre: { [Op.like]: `%${search}%` } },
                            { email: { [Op.like]: `%${search}%` } }
                        ]
                    } : {} 
                }];
                break;
            case 'publicacionesVencidas':
                model = Publicacion;
                where = {
                    presupuesto_restante: { [Op.lte]: 0.00 },
                    content: { [Op.like]: `%${search}%` },
                    ...(adminIds.length > 0 ? { id_usuario: { [Op.notIn]: adminIds } } : {})
                };
                attributes = ['id_publicacion', 'content', 'estado', ['fecha', 'fecha_display']];
                include = [{ model: Usuario, as: 'usuario', attributes: ['nombre'] }];
                break;
            default:
                return res.status(400).json({ success: false, error: "Tipo de KPI no válido" });
        }

        const { count, rows } = await model.findAndCountAll({
            where,
            include,
            attributes,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: customOrder || [['fecha_registro', 'DESC'], ['fecha', 'DESC']].filter(o => model.rawAttributes[o[0]])
        });

        res.json({
            success: true,
            data: rows,
            total: count,
            totalPages: Math.ceil(count / limit)
        });

    } catch (error) {
        console.error("Error al obtener detalles:", error);
        res.status(500).json({ success: false, error: "Error al obtener detalles" });
    }
};

/**
 * Obtener nombres de referidos de un usuario
 */
const getReferralNames = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const referidos = await RedNiveles.findAll({
            where: { id_patrocinador: id_usuario },
            include: [{ model: Usuario, as: 'usuario', attributes: ['nombre', 'email', 'fecha_registro'] }],
            order: [['id_usuario', 'DESC']]
        });

        res.json({
            success: true,
            data: referidos.map(r => r.usuario)
        });
    } catch (error) {
        console.error("Error al obtener nombres de referidos:", error);
        res.status(500).json({ success: false, error: "Error al obtener nombres de referidos" });
    }
};

module.exports = {
    getGlobalStats,
    getKpiDetails,
    getReferralNames
};
