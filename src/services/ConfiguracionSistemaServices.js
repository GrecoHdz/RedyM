const ConfiguracionSistema = require('../repositories/configuracionSistemaRepository');

const getAllConfiguracionSistema = async () => {
    try {
        const configuracionSistema = await ConfiguracionSistema.getAllConfiguracionSistema();
        return (configuracionSistema) ? configuracionSistema : [];
    } catch (error) {
        throw error;
    }
}

const getConfiguracionSistemaById = async (id) => {
    try {
        const configuracionSistema = await ConfiguracionSistema.getConfiguracionSistemaById(id,);
        return (configuracionSistema) ? configuracionSistema : [];
    } catch (error) {
        throw error;
    }

}

const createConfiguracionSistema = async (data) => {
    try {
        const configuracionSistema = await ConfiguracionSistema.createConfiguracionSistema(data);
        return (configuracionSistema) ? configuracionSistema : [];
    } catch (error) {
        throw error;
    }

}

const updateConfiguracionSistema = async (data, id) => {
    try {
        const configuracionSistema = await ConfiguracionSistema.updateConfiguracionSistema(data, id);
        return (configuracionSistema) ? configuracionSistema : [];
    } catch (error) {
        throw error;
    }

}

const deleteConfiguracionSistema = async (id) => {
    try {
        const configuracionSistema = await ConfiguracionSistema.deleteConfiguracionSistema(id);
        return (configuracionSistema) ? configuracionSistema : [];
    } catch (error) {
        throw error;
    }

}

module.exports = {
    getAllConfiguracionSistema,
    getConfiguracionSistemaById,
    createConfiguracionSistema,
    updateConfiguracionSistema,
    deleteConfiguracionSistema,
}