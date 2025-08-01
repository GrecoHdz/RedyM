'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('TransaccionBancaria', {
      transaccionId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      usuarioId: {
        type: Sequelize.INTEGER
      },
      tipoTransaccionId: {
        type: Sequelize.INTEGER
      },
      monto: {
        type: Sequelize.DOUBLE
      },
      numeroReferencia: {
        type: Sequelize.STRING
      },
      banco: {
        type: Sequelize.STRING
      },
      cuentaBancaria: {
        type: Sequelize.STRING
      },
      comprobanteUrl: {
        type: Sequelize.STRING
      },
      estadoTransaccionId: {
        type: Sequelize.INTEGER
      },
      fechaSolicitud: {
        type: Sequelize.DATE
      },
      fechaProcesamiento: {
        type: Sequelize.DATE
      },
      procesadoPor: {
        type: Sequelize.INTEGER
      },
      observaciones: {
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
    await queryInterface.dropTable('TransaccionBancaria');
  }
};