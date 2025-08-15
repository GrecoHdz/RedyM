const publicacionServices = require('../services/publicacionServices');
const ResponseHandler = require('../utils/responseHandler'); // Ajusta la ruta según tu estructura

const createPublicacion = async (req, res, next) => {
    try {
        const {
            usuarioId,
            tipoPublicacionId,
            titulo,
            descripcion
        } = req.body;

        // Validaciones básicas
        if (!usuarioId || !tipoPublicacionId || !titulo || !descripcion) {
            return res.status(400).json(
                ResponseHandler.error('Todos los campos son obligatorios: usuarioId, tipoPublicacionId, titulo, descripcion')
            );
        }

        // Verificar que se subieron archivos
        if (!req.files || req.files.length === 0) {
            return res.status(400).json(
                ResponseHandler.error('Debe proporcionar al menos un archivo (imagen o video)')
            );
        }

        // Validar límite de archivos
        if (req.files.length > 10) {
            return res.status(400).json(
                ResponseHandler.error('No se pueden subir más de 10 archivos por publicación')
            );
        }

        // Preparar datos para el servicio
        const data = {
            usuarioId: parseInt(usuarioId),
            tipoPublicacionId: parseInt(tipoPublicacionId),
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            adjuntos: req.files // Array de archivos de multer
        };

        console.log(`Creando publicación con ${req.files.length} archivos para usuario ${usuarioId}`);

        // Llamar al servicio
        const result = await publicacionServices.createPublicacion(data);

        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error en publicacionControllers.createPublicacion:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error interno del servidor: ${error.message}`)
        );
    }
};

const getPublicacionById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json(
                ResponseHandler.error('ID de publicación inválido')
            );
        }

        const result = await publicacionServices.getPublicacionById(parseInt(id));

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(404).json(result);
        }

    } catch (error) {
        console.error('Error en publicacionControllers.getPublicacionById:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error interno del servidor: ${error.message}`)
        );
    }
};

const getAllPublicaciones = async (req, res, next) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        // Validar parámetros
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json(
                ResponseHandler.error('El parámetro limit debe ser un número entre 1 y 100')
            );
        }

        if (isNaN(offsetNum) || offsetNum < 0) {
            return res.status(400).json(
                ResponseHandler.error('El parámetro offset debe ser un número mayor o igual a 0')
            );
        }

        const result = await publicacionServices.getAllPublicaciones(limitNum, offsetNum);

        return res.status(200).json(result);

    } catch (error) {
        console.error('Error en publicacionControllers.getAllPublicaciones:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error interno del servidor: ${error.message}`)
        );
    }
};

const deletePublicacion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { usuarioId } = req.body; // O puedes obtenerlo del token JWT si usas autenticación

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json(
                ResponseHandler.error('ID de publicación inválido')
            );
        }

        if (!usuarioId || isNaN(parseInt(usuarioId))) {
            return res.status(400).json(
                ResponseHandler.error('ID de usuario inválido')
            );
        }

        const result = await publicacionServices.deletePublicacion(parseInt(id), parseInt(usuarioId));

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error('Error en publicacionControllers.deletePublicacion:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error interno del servidor: ${error.message}`)
        );
    }
};

// Función auxiliar para obtener publicaciones por usuario
const getPublicacionesByUsuario = async (req, res, next) => {
    try {
        const { usuarioId } = req.params;
        const { limit = 20, offset = 0 } = req.query;

        if (!usuarioId || isNaN(parseInt(usuarioId))) {
            return res.status(400).json(
                ResponseHandler.error('ID de usuario inválido')
            );
        }

        // Esta función necesitaría implementarse en el repositorio si la necesitas
        // const result = await publicacionServices.getPublicacionesByUsuario(parseInt(usuarioId), limit, offset);

        return res.status(200).json(
            ResponseHandler.success([], 'Función no implementada aún')
        );

    } catch (error) {
        console.error('Error en publicacionControllers.getPublicacionesByUsuario:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error interno del servidor: ${error.message}`)
        );
    }
};

module.exports = {
    createPublicacion,
    getPublicacionById,
    getAllPublicaciones,
    deletePublicacion,
    getPublicacionesByUsuario
};