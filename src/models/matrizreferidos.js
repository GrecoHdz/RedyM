'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MatrizReferidos extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  MatrizReferidos.init({
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
    estado: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'MatrizReferidos',
  });
  return MatrizReferidos;
};