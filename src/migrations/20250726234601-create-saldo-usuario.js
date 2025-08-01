'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SaldoUsuarios', {
      saldoId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      usuarioId: {
        type: Sequelize.INTEGER
      },
      saldoPorLikes: {
        type: Sequelize.DOUBLE
      },
      saldoPorReferidos: {
        type: Sequelize.DOUBLE
      },
      saldoRetirado: {
        type: Sequelize.DOUBLE
      },
      saldoDisponible: {
        type: Sequelize.DOUBLE
      },
      ultimaActualizacion: {
        type: Sequelize.DATE
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
    await queryInterface.dropTable('SaldoUsuarios');
  }
};