'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ConfiguracionSistemas', {
      configuracionId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      precioSuscripcion: {
        type: Sequelize.DOUBLE
      },
      gananciasPorLike: {
        type: Sequelize.DOUBLE
      },
      porcentajeComisionNivel: {
        type: Sequelize.DOUBLE
      },
      fechaActualizacion: {
        type: Sequelize.DATE
      },
      actualizadoPor: {
        type: Sequelize.INTEGER
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
    await queryInterface.dropTable('ConfiguracionSistemas');
  }
};