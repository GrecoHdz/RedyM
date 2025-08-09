'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MatrizReferido extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  MatrizReferido.init({
    matrizId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    referenteId: DataTypes.INTEGER,
    referidoId: DataTypes.INTEGER,
    nivel: DataTypes.INTEGER,
    posicion: DataTypes.INTEGER,
    fechaIngreso: DataTypes.DATE,
    esForzado: DataTypes.BOOLEAN,
    nivelAbsoluto: DataTypes.INTEGER,
    estado: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'MatrizReferido',
  });
  return MatrizReferido;
};