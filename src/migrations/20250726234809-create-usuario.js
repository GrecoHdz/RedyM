'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Usuarios', {
      usuarioId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombres: {
        type: Sequelize.STRING
      },
      apellidos: {
        type: Sequelize.STRING
      },
      correo: {
        type: Sequelize.STRING
      },      
      dni: {
        type: Sequelize.STRING
      },
      clave: {
        type: Sequelize.STRING
      },
      telefono: {
        type: Sequelize.STRING
      },
      fechaRegistro: {
        type: Sequelize.DATE
      },
      esSuscriptor: {
        type: Sequelize.BOOLEAN
      },
      fechaSuscripcion: {
        type: Sequelize.DATE
      },
      esAdmin: {
        type: Sequelize.BOOLEAN
      },
      estado: {
        type: Sequelize.BOOLEAN
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Usuarios');
  }
};