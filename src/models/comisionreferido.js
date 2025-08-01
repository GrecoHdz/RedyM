'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ComisionReferido extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ComisionReferido.init({
    comisionId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    beneficiarioId: DataTypes.INTEGER,
    referidoId: DataTypes.INTEGER,
    nivel: DataTypes.INTEGER,
    montoSuscripcion: DataTypes.DOUBLE,
    montoComision: DataTypes.DOUBLE,
    fechaGeneracion: DataTypes.DATE,
    estado: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'ComisionReferido',
  });
  return ComisionReferido;
};