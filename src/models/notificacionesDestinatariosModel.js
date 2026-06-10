const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

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
        return await NotificacionDestinatario.create({
            id_notificacion: plantilla.id_notificacion,
            id_usuario,
            leido: false,
            fecha_creacion: new Date(),
            fecha_leido: null
        });
    } catch (error) {
        console.error("Error en NotificacionDestinatario.notificar:", error);
        throw error;
    }
};

module.exports = NotificacionDestinatario;

