'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ComisionReferidos', {
      comisionId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      beneficiarioId: {
        type: Sequelize.INTEGER
      },
      referidoId: {
        type: Sequelize.INTEGER
      },
      nivel: {
        type: Sequelize.INTEGER
      },
      montoSuscripcion: {
        type: Sequelize.DOUBLE
      },
      montoComision: {
        type: Sequelize.DOUBLE
      },
      fechaGeneracion: {
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
    await queryInterface.dropTable('ComisionReferidos');
  }
};