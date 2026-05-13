const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Interaccion = sequelize.define("Interaccion", {
    id_interaccion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_publicacion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'publicacion',
            key: 'id_publicacion'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuario',
            key: 'id_usuario'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    tipo: {
        type: DataTypes.ENUM('like', 'poll', 'share', 'video_view', 'click', 'visita_web', 'visita_whatsapp'),
        allowNull: false
    },
    detalle: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    monto_ganado: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    }
}, {
    timestamps: false,
    tableName: 'interaccion'
});

module.exports = Interaccion;
