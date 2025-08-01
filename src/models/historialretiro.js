'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class HistorialRetiro extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  HistorialRetiro.init({
    retiroId:{
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    usuarioId: DataTypes.INTEGER,
    transaccionId: DataTypes.INTEGER,
    montoSolicitado: DataTypes.DOUBLE,
    montoAprobado: DataTypes.DOUBLE,
    fechaSolicitud: DataTypes.DATE,
    fechaAprobacion: DataTypes.DATE,
    estadoRetiroId: DataTypes.INTEGER,
    motivoRechazo: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'HistorialRetiro',
  });
  return HistorialRetiro;
};