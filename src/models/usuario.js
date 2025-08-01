'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Usuario extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Usuario.init({
    usuarioId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    nombres: DataTypes.STRING,
    apellidos: DataTypes.STRING,
    correo: DataTypes.STRING,
    dni: DataTypes.STRING,
    clave: DataTypes.STRING,
    telefono: DataTypes.STRING,
    fechaRegistro: DataTypes.DATE,
    esSuscriptor: DataTypes.BOOLEAN,
    fechaSuscripcion: DataTypes.DATE,
    esAdmin: DataTypes.BOOLEAN,
    estado: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Usuario',
  });
  return Usuario;
};