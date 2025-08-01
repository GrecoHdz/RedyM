'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('HistorialRetiros', {
      retiroId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      usuarioId: {
        type: Sequelize.INTEGER
      },
      transaccionId: {
        type: Sequelize.INTEGER
      },
      montoSolicitado: {
        type: Sequelize.DOUBLE
      },
      montoAprobado: {
        type: Sequelize.DOUBLE
      },
      fechaSolicitud: {
        type: Sequelize.DATE
      },
      fechaAprobacion: {
        type: Sequelize.DATE
      },
      estadoRetiroId: {
        type: Sequelize.INTEGER
      },
      motivoRechazo: {
        type: Sequelize.TEXT
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
    await queryInterface.dropTable('HistorialRetiros');
  }
};