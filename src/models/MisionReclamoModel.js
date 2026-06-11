const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MisionReclamo = sequelize.define("MisionReclamo", {
    id_reclamo: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
    id_mision: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'mision_especial',
            key: 'id_mision'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
    },
    tipo: {
        type: DataTypes.ENUM('auto', 'especial'),
        allowNull: false
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'aprobado', 'rechazado'),
        allowNull: false,
        defaultValue: 'pendiente'
    },
    monto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    monto_otorgado: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    respuesta: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    timestamps: false,
    tableName: 'mision_reclamo'
});

module.exports = MisionReclamo;
