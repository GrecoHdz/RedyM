const usuarioRepository = require('../repositories/usuarioRepository');
const { generateToken } = require('../utils/tokenManager');
const bcryp = require("bcrypt");

const getAllUsuario = async () => {
    try {
        const usuario = await usuarioRepository.getAllUsuario();
        return (usuario) ? usuario : [];
    } catch (error) {
        throw error;
    }
}

const getUsuarioById = async (id) => {
    try {
        const usuario = await usuarioRepository.getUsuarioById(id,);
        return (usuario) ? usuario : [];
    } catch (error) {
        throw error;
    }

}

const createUsuario = async (data) => {
    try {
        const usuario = await usuarioRepository.createUsuario(data);
        return (usuario) ? usuario : [];
    } catch (error) {
        throw error;
    }

}

const updateUsuario = async (data, id) => {
    try {
        const usuario = await usuarioRepository.updateUsuario(data, id);
        return (usuario) ? usuario : [];
    } catch (error) {
        throw error;
    }

}

const deleteUsuario = async (id) => {
    try {
        const usuario = await usuarioRepository.deleteUsuario(id);
        return (usuario) ? usuario : [];
    } catch (error) {
        throw error;
    }

}

const login = async (data, res) => {
    try {

        const {
            correo,
            clave,
        } = data

        const usuario = await usuarioRepository.login(correo)

        if (usuario) {

            const isSame = await bcryp.compare(clave, usuario.clave)

            if (isSame) {

                const { token, expiresIn } = generateToken(usuario.usuarioId)

                let userData = {
                    usuarioId: usuario.usuarioId,
                    nombres: usuario.nombres,
                    apellidos: usuario.apellidos,
                    correo: usuario.correo,
                    dni: usuario.dni,
                    telefono: usuario.telefono,
                    esSuscriptor: usuario.esSuscriptor,
                    esAdmin: usuario.esAdmin,
                }

                const authenticated = true;

                return {
                    authenticated,
                    userData,
                    token,
                    expiresIn
                }
            }
            return "Authentication failed";
        } else {
            return "Authentication failed";
        }

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