const usuarioServices = require('../services/usuarioServices');
const bcryp = require("bcrypt");

const getAllUsuario = async (req, res, next) => {
    try {
        const usuario = await usuarioServices.getAllUsuario();
        return res.status(200).json(usuario);
    } catch (error) {
        next(error);
    }
}

const getUsuarioById = async (req, res, next) => {
    const id = req.params.id;
    try {
        const usuario = await usuarioServices.getUsuarioById(id);

        return res.status(200).json(usuario);
    } catch (error) {
        next(error);
    }
}

const createUsuario = async (req, res, next) => {

    const {
        nombres,
        apellidos,
        correo,
        dni,
        clave,
        telefono,
        estado
    } = req.body;

    const data = {
        nombres,
        apellidos,
        correo,
        telefono,
        dni,
        clave: await bcryp.hash(clave, 10),
        estado
    }

    try {
        const usuario = await usuarioServices.createUsuario(data);
        return res.status(200).json(usuario);
    } catch (error) {
        next(error);
    }
}

const updateUsuario = async (req, res, next) => {
    const id = req.params.id;

    const {
        nombres,
        apellidos,
        correo,
        dni,
        clave,
        telefono,
        estado
    } = req.body;

    const data = {
        nombres,
        apellidos,
        correo,
        telefono,
        dni,
        clave: await bcryp.hash(clave, 10),
        estado
    }

    try {
        const usuario = await usuarioServices.updateUsuario(data, id);
        return res.status(200).json(usuario);
    } catch (error) {
        next(error);
    }
}

const deleteUsuario = async (req, res, next) => {
    const id = req.params.id;
    try {
        const usuario = await usuarioServices.deleteUsuario(id);
        return res.status(200).json(usuario);
    } catch (error) {
        next(error);
    }
}

const login = async (req, res, next) => {
    try {
        const {
            correo,
            clave
        } = req.body;

        const data = {
            correo,
            clave
        };

        const {
            authenticated,
            userData,
            token,
            expiresIn
        } = await usuarioServices.login(data, res);

        if (authenticated) {
            res.cookie("token", token, {
                httpOnly: true,
                sameSite: 'None'
            });

            return res.status(200).json({
                ok: true,
                userData: userData,
                mensage: "Usuario correcto",
                authenticated,
                token,
                expiresIn
            });
        }

        return res.status(200).send({
            ok: false,
            data: null,
            authenticated,
            mensage: "Usuario o clave incorrectos"
        });

    } catch (error) {
        res.status(500).send('Error al intentar iniciar sesion:' + error);
        next(error);
    }
}


const logout = async (req, res, next) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
        });

        return res.status(200).json({
            ok: true,
            mensage: "Logout exitoso"
        });

    } catch (error) {
        res.status(500).send('Error al intentar cerrar sesión: ' + error);
        next(error);
    }
}

const subscribcion = async (req, res, next) => {

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
    } = req.body;

    const data = {
        usuarioId,
        tipoTransaccionId,
        monto,
        numeroReferencia,
        banco,
        cuentaBancaria,
        comprobanteUrl,
        procesadoPor,
        observaciones
    }

    try {
        const usuario = await usuarioServices.subscribcion(data);
        return res.status(200).json(usuario);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAllUsuario,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    login,
    logout,
    subscribcion,
}