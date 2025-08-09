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
      precioSuscripcionNivel1: {
        type: Sequelize.DOUBLE
      },
      precioSuscripcionNivel2: {
        type: Sequelize.DOUBLE
      },
      precioSuscripcionNivel3: {
        type: Sequelize.DOUBLE
      },
      precioSuscripcionNivel4: {
        type: Sequelize.DOUBLE
      },
      precioSuscripcionNivel5: {
        type: Sequelize.DOUBLE
      },
      gananciasPorLike: {
        type: Sequelize.DOUBLE
      },
      gananciasPorCompartir: {
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