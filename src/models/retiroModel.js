const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Retiro = sequelize.define("Retiro", {
  id_retiro: {
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
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  detalles_cuenta: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.ENUM("pendiente", "aprobado", "rechazado"),
    allowNull: false,
    defaultValue: "pendiente"
  }
}, {
  timestamps: false,
  tableName: "retiros",
  indexes: [
    {
      name: 'idx_retiro_id_usuario',
      fields: ['id_usuario']
    },
    {
      name: 'idx_retiro_estado',
      fields: ['estado']
    }
  ]
});

module.exports = Retiro;
