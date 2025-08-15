const publicacionRepository = require('../repositories/publicacionRepository');

const createPublicacion = async (data) => {
    try {
        const result = await publicacionRepository.createPublicacion(data);
        return result;
    } catch (error) {
        console.error('Error en publicacionServices.createPublicacion:', error);
        throw error;
    }
}

const getPublicacionById = async (publicacionId) => {
    try {
        const result = await publicacionRepository.getPublicacionById(publicacionId);
        return result;
    } catch (error) {
        console.error('Error en publicacionServices.getPublicacionById:', error);
        throw error;
    }
}

const getAllPublicaciones = async (limit, offset) => {
    try {
        const result = await publicacionRepository.getAllPublicaciones(limit, offset);
        return result;
    } catch (error) {
        console.error('Error en publicacionServices.getAllPublicaciones:', error);
        throw error;
    }
}

const deletePublicacion = async (publicacionId, usuarioId) => {
    try {
        const result = await publicacionRepository.deletePublicacion(publicacionId, usuarioId);
        return result;
    } catch (error) {
        console.error('Error en publicacionServices.deletePublicacion:', error);
        throw error;
    }
}

module.exports = {
    createPublicacion,
    getPublicacionById,
    getAllPublicaciones,
    deletePublicacion,
};