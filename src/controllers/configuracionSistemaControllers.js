const ConfiguracionSistemaServices = require('../services/ConfiguracionSistemaServices');

const getAllConfiguracionSistema = async (req, res, next) => {
    try {
        const configuracionSistema = await ConfiguracionSistemaServices.getAllConfiguracionSistema();
        return res.status(200).json(configuracionSistema);
    } catch (error) {
        next(error);
    }
}

const getConfiguracionSistemaById = async (req, res, next) => {
    const id = req.params.id;
    try {
        const configuracionSistema = await ConfiguracionSistemaServices.getConfiguracionSistemaById(id);

        return res.status(200).json(configuracionSistema);
    } catch (error) {
        next(error);
    }
}

const createConfiguracionSistema = async (req, res, next) => {

    const {
        precioSuscripcionNivel1,
        precioSuscripcionNivel2,
        precioSuscripcionNivel3,
        precioSuscripcionNivel4,
        precioSuscripcionNivel5,
        gananciasPorLike,
        gananciasPorCompartir,
        porcentajeComisionNivel,
    } = req.body;

    const data = {
        precioSuscripcionNivel1,
        precioSuscripcionNivel2,
        precioSuscripcionNivel3,
        precioSuscripcionNivel4,
        precioSuscripcionNivel5,
        gananciasPorLike,
        gananciasPorCompartir,
        porcentajeComisionNivel,
    }

    try {
        const configuracionSistema = await ConfiguracionSistemaServices.createConfiguracionSistema(data);
        return res.status(200).json(configuracionSistema);
    } catch (error) {
        next(error);
    }
}

const updateConfiguracionSistema = async (req, res, next) => {
    const id = req.params.id;

    const {
        precioSuscripcionNivel1,
        precioSuscripcionNivel2,
        precioSuscripcionNivel3,
        precioSuscripcionNivel4,
        precioSuscripcionNivel5,
        gananciasPorLike,
        gananciasPorCompartir,
        porcentajeComisionNivel,
        actualizadoPor,
    } = req.body;

    const data = {
        precioSuscripcionNivel1,
        precioSuscripcionNivel2,
        precioSuscripcionNivel3,
        precioSuscripcionNivel4,
        precioSuscripcionNivel5,
        gananciasPorLike,
        gananciasPorCompartir,
        porcentajeComisionNivel,
        actualizadoPor,
    }

    try {
        const configuracionSistema = await ConfiguracionSistemaServices.updateConfiguracionSistema(data, id);
        return res.status(200).json(configuracionSistema);
    } catch (error) {
        next(error);
    }
}

const deleteConfiguracionSistema = async (req, res, next) => {
    const id = req.params.id;
    try {
        const configuracionSistema = await ConfiguracionSistemaServices.deleteConfiguracionSistema(id);
        return res.status(200).json(configuracionSistema);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAllConfiguracionSistema,
    getConfiguracionSistemaById,
    createConfiguracionSistema,
    updateConfiguracionSistema,
    deleteConfiguracionSistema,
}