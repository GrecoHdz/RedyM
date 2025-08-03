const ResponseHandler = require('../utils/responseHandler')
const db = require('../models')
const Usuario = db.Usuario

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

module.exports = {
    getAllUsuario,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    login
}