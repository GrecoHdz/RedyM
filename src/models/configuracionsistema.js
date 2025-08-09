'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ConfiguracionSistema extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ConfiguracionSistema.init({
    configuracionId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    precioSuscripcionNivel1: DataTypes.DOUBLE,
    precioSuscripcionNivel2: DataTypes.DOUBLE,
    precioSuscripcionNivel3: DataTypes.DOUBLE,
    precioSuscripcionNivel4: DataTypes.DOUBLE,
    precioSuscripcionNivel5: DataTypes.DOUBLE,
    gananciasPorLike: DataTypes.DOUBLE,
    gananciasPorCompartir: DataTypes.DOUBLE,
    porcentajeComisionNivel: DataTypes.DOUBLE,
    fechaActualizacion: DataTypes.DATE,
    actualizadoPor: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'ConfiguracionSistema',
  });
  return ConfiguracionSistema;
};