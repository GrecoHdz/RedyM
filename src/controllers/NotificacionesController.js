const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const Notificacion = require("../models/notificacionesModel");
const NotificacionDestinatario = require("../models/notificacionesDestinatariosModel");
const Usuario = require("../models/usuariosModel");
const Rol = require("../models/rolesModel");
const Ciudad = require("../models/ciudadesModel");
const webpush = require("web-push");
const SuscripcionNotificacion = require("../models/suscripcionesNotificacionesModel");

// Configurar Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:contactoredymercadeo@gmail.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
    } catch (error) {
        console.error('❌ Error configurando Web Push:', error.message);
    }
}

// Helper para enviar notificaciones push
const enviarPushHelper = async (destinatarios, titulo, cuerpo, data = {}) => {
    try {
        const userIds = destinatarios.map(d => d.id_usuario);

        // Obtener suscripciones de los usuarios afectados
        const subscriptions = await SuscripcionNotificacion.findAll({
            where: {
                id_usuario: { [Op.in]: userIds }
            }
        });

        if (subscriptions.length === 0) return;

        const notifications = subscriptions.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.keys_auth,
                    p256dh: sub.keys_p256dh
                }
            };

            const payload = JSON.stringify({
                title: titulo,
                body: cuerpo,
                icon: '/favicon.ico',

                data: {
                    url: data.url || '/',
                    ...data
                }
            });

            return webpush.sendNotification(pushSubscription, payload)
                .catch(err => {
                    console.error('Error enviando web push (helper):', err);
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // La suscripción ya no es válida, eliminarla
                        return SuscripcionNotificacion.destroy({ where: { id_suscripcion: sub.id_suscripcion } });
                    }
                });
        });

        await Promise.allSettled(notifications);
    } catch (error) {
        console.error('❌ Error general en enviarPushHelper:', error);
    }
};

// 1️⃣ Obtener todas las notificaciones (Log Global de Actividad)
const obtenerTodas = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const { count, rows: notificaciones } = await NotificacionDestinatario.findAndCountAll({
            include: [
                {
                    model: Notificacion,
                    as: 'notificacion',
                    attributes: ['titulo', 'creado_por', 'tipo'],
                    required: true
                },
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['nombre'],
                    required: true,
                    include: [{
                        model: Rol,
                        as: 'rol',
                        attributes: ['nombre_rol'],
                        required: true
                    }]
                }
            ],
            attributes: ['id_destinatario_notificacion', 'id_notificacion', 'fecha_creacion', 'leido', 'fecha_leido'],
            order: [['fecha_creacion', 'DESC']],
            raw: true,
            nest: true,
            limit,
            offset
        });

        const notificacionesFormateadas = notificaciones.map(notif => ({
            id: notif.id_destinatario_notificacion,
            titulo: notif.notificacion.titulo,
            tipo: notif.notificacion.tipo,
            creado_por: notif.notificacion.creado_por,
            nombreUsuario: notif.usuario.nombre,
            rolUsuario: notif.usuario.rol.nombre_rol,
            fecha: notif.fecha_creacion,
            leido: notif.leido,
            fechaLeido: notif.fecha_leido
        }));

        res.json({
            success: true,
            data: notificacionesFormateadas,
            pagination: {
                total: count,
                page,
                pages: Math.ceil(count / limit),
                limit
            }
        });
    } catch (error) {
        console.error("Error al obtener log global de notificaciones:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener el log de actividad",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// 1.1️⃣ Obtener notificaciones manuales (creadas por admin/usuarios)
const obtenerManuales = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const { count, rows: notificaciones } = await Notificacion.findAndCountAll({
            where: {
                [Op.or]: [
                    { tipo: 'manual' },
                    { creado_por: { [Op.ne]: 'Sistema' } }
                ]
            },
            order: [['fecha_creacion', 'DESC']],
            limit,
            offset
        });

        res.json({
            success: true,
            data: notificaciones,
            pagination: {
                total: count,
                page,
                pages: Math.ceil(count / limit),
                limit
            }
        });
    } catch (error) {
        console.error("Error al obtener notificaciones manuales:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener notificaciones manuales"
        });
    }
};

// 2️⃣ Obtener notificaciones por usuario
const obtenerPorUsuario = async (req, res) => {
    const { id_usuario } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const { count, rows: notificaciones } = await NotificacionDestinatario.findAndCountAll({
            include: [
                {
                    model: Notificacion,
                    as: 'notificacion',
                    attributes: ['titulo', 'creado_por', 'tipo'],
                    required: true
                }
            ],
            where: { id_usuario },
            attributes: ['id_destinatario_notificacion', 'id_notificacion', 'fecha_creacion', 'leido', 'fecha_leido'],
            order: [['fecha_creacion', 'DESC']],
            limit,
            offset,
            raw: true,
            nest: true
        });

        const totalPages = Math.ceil(count / limit);
        const unreadCount = await NotificacionDestinatario.count({
            where: { id_usuario, leido: false }
        });

        res.json({
            success: true,
            data: notificaciones.map(notif => ({
                id: notif.id_destinatario_notificacion,
                titulo: notif.notificacion.titulo,
                fecha: notif.fecha_creacion,
                leido: notif.leido,
                creadoPor: notif.notificacion.creado_por,
                tipo: notif.notificacion.tipo
            })),
            pagination: {
                total: count,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            unreadCount
        });
    } catch (error) {
        console.error("Error al obtener notificaciones por usuario:", error);
        res.status(500).json({
            success: false,
            message: "Error al obtener notificaciones del usuario"
        });
    }
};

// 3️⃣ Crear Notificación
const crearNotificacion = async (req, res) => {
    const { tipo, titulo, creado_por } = req.body;
    try {
        const nueva = await Notificacion.create({
            tipo,
            titulo,
            creado_por,
            fecha_creacion: new Date()
        });
        res.json({ success: true, data: nueva });
    } catch (error) {
        console.error("Error al crear notificación:", error);
        res.status(500).json({ success: false, message: "Error al crear notificación" });
    }
};

// 4️⃣ Enviar notificación
const enviarNotificacion = async (req, res) => {
    let { id_notificacion, titulo, id_usuario, nombre_rol, global, id_ciudad } = req.body;
    const t = await sequelize.transaction();
    let ciudad = null;

    try {
        let notificacion = null;

        if (!id_notificacion && titulo) {
            notificacion = await Notificacion.findOne({ where: { titulo }, raw: true });
            if (!notificacion) {
                await t.rollback();
                return res.status(404).json({ success: false, message: `No se encontró notificación '${titulo}'` });
            }
            id_notificacion = notificacion.id_notificacion;
        }

        if (!notificacion) {
            notificacion = await Notificacion.findByPk(id_notificacion, { raw: true });
        }

        if (!notificacion) {
            await t.rollback();
            return res.status(404).json({ success: false, message: "La notificación no existe" });
        }

        let destinatarios = [];

        if (id_usuario && !global && !nombre_rol && !id_ciudad) {
            destinatarios.push({
                id_notificacion, id_usuario, leido: false, fecha_creacion: new Date(), fecha_leido: null
            });
        } else if (id_ciudad && !global) {
            ciudad = await Ciudad.findByPk(id_ciudad, { attributes: ['id_ciudad', 'nombre_ciudad'], raw: true });
            if (!ciudad) {
                await t.rollback();
                return res.status(404).json({ success: false, message: `No se encontró ciudad ${id_ciudad}` });
            }
            const whereClause = { id_ciudad };
            if (nombre_rol) {
                const rol = await Rol.findOne({ where: { nombre_rol }, attributes: ['id_rol'], raw: true });
                if (rol) whereClause.id_rol = rol.id_rol;
            }
            const usuarios = await Usuario.findAll({ where: whereClause, attributes: ['id_usuario'] });
            destinatarios = usuarios.map(u => ({
                id_notificacion, id_usuario: u.id_usuario, leido: false, fecha_creacion: new Date(), fecha_leido: null
            }));
        } else if (nombre_rol && !global) {
            const rol = await Rol.findOne({ where: { nombre_rol }, attributes: ['id_rol'], raw: true });
            if (!rol) {
                await t.rollback();
                return res.status(404).json({ success: false, message: `No se encontró el rol '${nombre_rol}'` });
            }
            const usuarios = await Usuario.findAll({ where: { id_rol: rol.id_rol }, attributes: ['id_usuario'] });
            destinatarios = usuarios.map(u => ({
                id_notificacion, id_usuario: u.id_usuario, leido: false, fecha_creacion: new Date(), fecha_leido: null
            }));
        } else if (global) {
            const usuarios = await Usuario.findAll({ attributes: ['id_usuario'] });
            destinatarios = usuarios.map(u => ({
                id_notificacion, id_usuario: u.id_usuario, leido: false, fecha_creacion: new Date(), fecha_leido: null
            }));
        }

        if (destinatarios.length === 0) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "No se encontraron destinatarios" });
        }

        await NotificacionDestinatario.bulkCreate(destinatarios, { transaction: t });

        enviarPushHelper(destinatarios, 'Nueva notificación', notificacion.titulo, {
            id_notificacion: notificacion.id_notificacion,
            tipo: notificacion.tipo
        }).catch(e => console.error('Error enviando push:', e));

        await t.commit();
        res.json({ success: true, message: "Enviada correctamente", data: { cantidad_destinatarios: destinatarios.length } });
    } catch (error) {
        if (t && !t.finished) await t.rollback();
        console.error('❌ Error enviando notificación:', error);
        res.status(500).json({ success: false, message: "Error al enviar notificación" });
    }
};

// 5️⃣ Marcar como leída
const marcarComoLeida = async (req, res) => {
    const { id_usuario } = req.body;
    try {
        const [updatedCount] = await NotificacionDestinatario.update(
            { leido: true, fecha_leido: new Date() },
            { where: { id_usuario, leido: false } }
        );
        res.json({ success: true, updatedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al actualizar" });
    }
};

// 6️⃣ Marcar individual
const marcarNotificacionIndividual = async (req, res) => {
    const { id_destinatario_notificacion } = req.body;
    try {
        const [updatedCount] = await NotificacionDestinatario.update(
            { leido: true, fecha_leido: new Date() },
            { where: { id_destinatario_notificacion, leido: false } }
        );
        res.json({ success: true, updatedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al actualizar" });
    }
};

// 7️⃣ Guardar Suscripción Push
const guardarSuscripcionPush = async (req, res) => {
    const { endpoint, keys, user_agent, expirationTime, id_usuario } = req.body;
    if (!endpoint || !keys || !id_usuario) {
        return res.status(400).json({ success: false, message: "Faltan datos" });
    }
    try {
        await SuscripcionNotificacion.destroy({ where: { id_usuario, endpoint: { [Op.ne]: endpoint } } });
        const [subscription, created] = await SuscripcionNotificacion.findOrCreate({
            where: { endpoint },
            defaults: {
                id_usuario,
                keys_auth: keys.auth,
                keys_p256dh: keys.p256dh,
                user_agent,
                expiration_time: expirationTime ? new Date(expirationTime) : null
            }
        });
        if (!created) {
            subscription.id_usuario = id_usuario;
            subscription.keys_auth = keys.auth;
            subscription.keys_p256dh = keys.p256dh;
            await subscription.save();
        }
        res.json({ success: true, message: "Suscripción guardada" });
    } catch (error) {
        console.error("Error guardando suscripción:", error);
        res.status(500).json({ success: false, message: "Error al guardar" });
    }
};

// 8️⃣ Eliminar Suscripción Push
const eliminarSuscripcionPush = async (req, res) => {
    const id_usuario = req.body.id_usuario || req.query.id_usuario || (req.user && req.user.id_usuario);
    try {
        await SuscripcionNotificacion.destroy({ where: { id_usuario } });
        res.json({ success: true, message: "Eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al eliminar" });
    }
};

// 9️⃣ Obtener Key VAPID
const obtenerVapidKey = (req, res) => {
    res.json({ success: true, key: process.env.VAPID_PUBLIC_KEY });
};

// 🔟 Eliminar Plantilla de Notificación
const eliminarNotificacion = async (req, res) => {
    const { id_notificacion } = req.params;
    try {
        const deletedCount = await Notificacion.destroy({
            where: { id_notificacion }
        });

        if (deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "No se encontró la notificación para eliminar"
            });
        }

        res.json({
            success: true,
            message: "Plantilla de notificación eliminada correctamente"
        });
    } catch (error) {
        console.error("Error al eliminar notificación:", error);
        res.status(500).json({
            success: false,
            message: "Error al eliminar la notificación"
        });
    }
};

module.exports = {
    obtenerTodas,
    obtenerManuales,
    obtenerPorUsuario,
    crearNotificacion,
    enviarNotificacion,
    marcarComoLeida,
    marcarNotificacionIndividual,
    guardarSuscripcionPush,
    eliminarSuscripcionPush,
    obtenerVapidKey,
    eliminarNotificacion
};
