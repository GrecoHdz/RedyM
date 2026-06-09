const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MisionEspecial = sequelize.define("mision_especial", {
    id_mision: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    titulo: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    emoji: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: '⚡'
    },
    valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    tipo_respuesta: {
        type: DataTypes.ENUM('escrita', 'seleccion'),
        allowNull: false,
        defaultValue: 'escrita'
    },
    opciones: {
        type: DataTypes.JSON, // Para guardar las opciones si es tipo seleccion
        allowNull: true
    },
    activa: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    respuesta_correcta: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    fecha_creacion: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false,
    tableName: "mision_especial",
});

module.exports = MisionEspecial;
