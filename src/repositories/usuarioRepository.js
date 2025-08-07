const ResponseHandler = require('../utils/responseHandler')
const db = require('../models')
const { sequelize } = require("../models")
const { QueryTypes, Transaction, } = require('sequelize')
const { Op } = require('sequelize')
const Usuario = db.Usuario
const TransaccionBancaria = db.TransaccionBancaria
const MatrizReferidos = db.MatrizReferidos
const ConfiguracionSistema = db.ConfiguracionSistema
const ComisionReferido = db.ComisionReferido
const SaldoUsuario = db.SaldoUsuario

const getAllUsuario = async () => {
    try {
        const usuario = await Usuario.findAll({
            attributes: { exclude: ['clave', 'createdAt', 'updatedAt'] }
        })
        return ResponseHandler.success(usuario)
    } catch (error) {
        throw error
    }
}

const getUsuarioById = async (id) => {
    try {
        const usuario = await Usuario.findOne({
            where: {
                usuarioId: id,
            },
            attributes: {
                exclude: ['clave', 'createdAt', 'updatedAt']
            }
        })
        return ResponseHandler.success(usuario)
    } catch (error) {
        throw error
    }
}

const createUsuario = async (data) => {
    try {
        const {
            nombres,
            apellidos,
            correo,
            dni,
            clave,
            telefono,
            estado
        } = data

        const existeDni = await Usuario.findOne({
            where: {
                dni: dni
            }
        })

        if (existeDni) {
            return ResponseHandler.error('El dni ya existe en el sistema')
        }

        const existeCorreo = await Usuario.findOne({
            where: {
                correo: correo
            }
        })

        if (existeCorreo) {
            return ResponseHandler.error('El correo ya existe en el sistema')
        }

        const usuario = await Usuario.create({
            nombres: nombres,
            apellidos: apellidos,
            correo: correo,
            dni: dni,
            clave: clave,
            telefono: telefono,
            fechaRegistro: new Date(),
            esSuscriptor: false,
            esAdmin: false,
            estado: estado
        })
        return ResponseHandler.success(usuario, 'Usuario creado exitosamente')
    } catch (error) {
        throw error
    }
}

const updateUsuario = async (data, id) => {
    try {
        const usuario = await Usuario.update(data, {
            where: {
                usuarioId: id,
            }
        })
        return ResponseHandler.success(usuario, 'Usuario actualizado exitosamente')
    } catch (error) {
        throw error
    }
}

const deleteUsuario = async (id) => {
    try {
        const usuario = await Usuario.destroy({
            where: {
                usuarioId: id,
            }
        })
        return ResponseHandler.success(usuario, 'Usuario eliminado exitosamente');
    } catch (error) {
        throw error
    }

}

const login = async (correo) => {
    try {
        const usuario = await Usuario.findOne({
            where: {
                correo: correo,
                estado: 1
            }
        })
        return usuario
    } catch (error) {
        throw error
    }
}

const subscribcion = async (data) => {
    const transaction = await db.sequelize.transaction()
    try {
        const {
            usuarioId,
            tipoTransaccionId,
            monto,
            numeroReferencia,
            banco,
            cuentaBancaria,
            comprobanteUrl,
            procesadoPor,
            observaciones
        } = data

        const usuario = await Usuario.findOne({
            where: {
                usuarioId: usuarioId,
                estado: 1
            },
            transaction
        })

        if (!usuario) {
            await transaction.rollback()
            return ResponseHandler.error('Usuario no encontrado o inactivo')
        }

        if (usuario.esSuscriptor) {
            await transaction.rollback()
            return ResponseHandler.error('El usuario ya tiene una suscripción activa')
        }

        // Crear la transacción bancaria
        const transaccion = await TransaccionBancaria.create({
            usuarioId: usuarioId,
            tipoTransaccionId: tipoTransaccionId,
            monto: monto,
            numeroReferencia: numeroReferencia,
            banco: banco,
            cuentaBancaria: cuentaBancaria,
            comprobanteUrl: comprobanteUrl,
            estadoTransaccionId: 2, // aprobada
            fechaSolicitud: new Date(),
            fechaProcesamiento: new Date(),
            procesadoPor: procesadoPor,
            observaciones: observaciones
        }, { transaction })

        // Actualizar usuario como suscriptor
        await Usuario.update({
            esSuscriptor: true,
            fechaSuscripcion: new Date()
        }, {
            where: { usuarioId: usuarioId },
            transaction
        })

        // Crear o actualizar saldo del usuario
        const [saldoUsuario, created] = await SaldoUsuario.findOrCreate({
            where: { usuarioId: usuarioId },
            defaults: {
                usuarioId: usuarioId,
                saldoPorLikes: 0,
                saldoPorReferidos: 0,
                saldoRetirado: 0,
                saldoDisponible: 0,
                estado: 1
            },
            transaction
        })

        await transaction.commit()

        return ResponseHandler.success({ usuarioId: usuario.usuarioId, transaccionId: transaccion.transaccionId },
                                       'Usuario suscrito exitosamente')
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}

module.exports = {
    getAllUsuario,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    login,
    subscribcion,
}