'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class TransaccionBancaria extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  TransaccionBancaria.init({
    transaccionId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    usuarioId: DataTypes.INTEGER,
    tipoTransaccionId: DataTypes.INTEGER,
    monto: DataTypes.DOUBLE,
    numeroReferencia: DataTypes.STRING,
    banco: DataTypes.STRING,
    cuentaBancaria: DataTypes.STRING,
    comprobanteUrl: DataTypes.STRING,
    estadoTransaccionId: DataTypes.INTEGER,
    fechaSolicitud: DataTypes.DATE,
    fechaProcesamiento: DataTypes.DATE,
    procesadoPor: DataTypes.INTEGER,
    observaciones: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'TransaccionBancaria',
  });
  return TransaccionBancaria;
};