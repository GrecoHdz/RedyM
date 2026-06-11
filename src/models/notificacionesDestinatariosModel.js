const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const webpush = require("web-push");
const SuscripcionNotificacion = require("./suscripcionesNotificacionesModel");
const { Op } = require("sequelize");

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

const NotificacionDestinatario = sequelize.define("NotificacionDestinatario", {
    id_destinatario_notificacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_notificacion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'notificaciones',
            key: 'id_notificacion'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuario',
            key: 'id_usuario'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    leido: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false
    },
    fecha_leido: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: false,
    tableName: "notificaciones_destinatarios",
});

/**
 * Registra una notificación para un usuario específico.
 * Busca la plantilla por título y crea el registro de destinatario.
 * 
 * @param {Object} params - Parámetros de la notificación
 * @param {string} params.tipo - Tipo de notificación (para crear si no existe)
 * @param {string} params.titulo - Título/Plantilla de la notificación
 * @param {number} params.id_usuario - ID del usuario que recibe la notificación
 * @param {string} [params.creado_por='Sistema'] - Generador de la notificación
 */
NotificacionDestinatario.notificar = async function({ tipo, titulo, id_usuario, creado_por = 'Sistema' }) {
    const Notificacion = require("./notificacionesModel");
    
    try {
        // 1. Buscar o crear la plantilla de notificación
        let [plantilla] = await Notificacion.findOrCreate({
            where: { titulo },
            defaults: {
                tipo,
                titulo,
                creado_por,
                fecha_creacion: new Date()
            }
        });

        // 2. Crear el registro para el destinatario
        const destinatario = await NotificacionDestinatario.create({
            id_notificacion: plantilla.id_notificacion,
            id_usuario,
            leido: false,
            fecha_creacion: new Date(),
            fecha_leido: null
        });

        // 3. Enviar push notification si es posible
        try {
            if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                // Obtener suscripciones del usuario
                const subscriptions = await SuscripcionNotificacion.findAll({
                    where: { id_usuario }
                });

                if (subscriptions.length > 0) {
                    const notifications = subscriptions.map(sub => {
                        const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: {
                                auth: sub.keys_auth,
                                p256dh: sub.keys_p256dh
                            }
                        };

                        const payload = JSON.stringify({
                            title: 'Nueva notificación',
                            body: titulo,
                            icon: '/favicon.ico',
                            data: {
                                url: '/cliente/dashboard',
                                tipo,
                                id_notificacion: plantilla.id_notificacion
                            }
                        });

                        return webpush.sendNotification(pushSubscription, payload)
                            .catch(err => {
                                if (err.statusCode === 410 || err.statusCode === 404) {
                                    // Suscripción inválida, eliminarla
                                    return SuscripcionNotificacion.destroy({ 
                                        where: { id_suscripcion: sub.id_suscripcion } 
                                    });
                                }
                            });
                    });

                    await Promise.allSettled(notifications);
                }
            }
        } catch (pushError) {
            console.error("Error al enviar push notification:", pushError);
        }

        return destinatario;
    } catch (error) {
        console.error("Error en NotificacionDestinatario.notificar:", error);
        throw error;
    }
};

module.exports = NotificacionDestinatario;

