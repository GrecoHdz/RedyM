'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MatrizReferidos', {
      matrizId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      referenteId: {
        type: Sequelize.INTEGER
      },
      referidoId: {
        type: Sequelize.INTEGER
      },
      nivel: {
        type: Sequelize.INTEGER
      },
      posicion: {
        type: Sequelize.INTEGER
      },
      fechaIngreso: {
        type: Sequelize.DATE
      },
      esForzado: {
        type: Sequelize.BOOLEAN
      },
      nivelAbsoluto: {
        type: Sequelize.INTEGER
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
    await queryInterface.dropTable('MatrizReferidos');
  }
};