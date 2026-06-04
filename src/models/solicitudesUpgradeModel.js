const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const SolicitudUpgrade = sequelize.define("SolicitudUpgrade", {
  id_solicitud: {
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
  id_cuenta: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'cuentas',
      key: 'id_cuenta'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  num_comprobante: {
    type: DataTypes.STRING,
    allowNull: true
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  nivel_destino: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.ENUM("pendiente", "aprobada", "rechazada"),
    allowNull: false,
    defaultValue: "pendiente"
  }
}, {
  timestamps: false,
  tableName: "solicitud_upgrade",
  indexes: [
    {
      name: 'idx_solupgrade_id_usuario',
      fields: ['id_usuario']
    },
    {
      name: 'idx_solupgrade_estado',
      fields: ['estado']
    }
  ]
});

module.exports = SolicitudUpgrade;
