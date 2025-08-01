'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SaldoUsuario extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  SaldoUsuario.init({
    saldoId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    usuarioId: DataTypes.INTEGER,
    saldoPorLikes: DataTypes.DOUBLE,
    saldoPorReferidos: DataTypes.DOUBLE,
    saldoRetirado: DataTypes.DOUBLE,
    saldoDisponible: DataTypes.DOUBLE,
    ultimaActualizacion: DataTypes.DATE,
    estado: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'SaldoUsuario',
  });
  return SaldoUsuario;
};