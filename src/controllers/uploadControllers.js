const uploadServices = require('../services/uploadServices');
const ResponseHandler = require('../utils/responseHandler')

const uploadFile = async (req, res, next) => {
    try {
        // Verificar si se subió un archivo
        if (!req.file) {
            return res.status(400).json(
                ResponseHandler.error('No se proporcionó ningún archivo')
            );
        }

        // Procesar el archivo subido
        const fileInfo = await uploadServices.uploadFile(req.file);

        return res.status(200).json(
            ResponseHandler.success(fileInfo, 'Archivo subido exitosamente')
        );
    } catch (error) {
        console.error('Error en uploadFile:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error al subir el archivo: ${error.message}`)
        );
    }
};

const uploadImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json(
                ResponseHandler.error('No se proporcionó ninguna imagen')
            );
        }

        const fileInfo = await uploadServices.uploadFile(req.file);

        return res.status(200).json(
            ResponseHandler.success(fileInfo, 'Imagen subida exitosamente')
        );
    } catch (error) {
        console.error('Error en uploadImage:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error al subir la imagen: ${error.message}`)
        );
    }
};

const uploadVideo = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json(
                ResponseHandler.error('No se proporcionó ningún video')
            );
        }

        const fileInfo = await uploadServices.uploadFile(req.file);

        return res.status(200).json(
            ResponseHandler.success(fileInfo, 'Video subido exitosamente')
        );
    } catch (error) {
        console.error('Error en uploadVideo:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error al subir el video: ${error.message}`)
        );
    }
};

const deleteFile = async (req, res, next) => {
    try {
        const { publicId, resourceType = 'image' } = req.body;

        if (!publicId) {
            return res.status(400).json(
                ResponseHandler.error('Se requiere el publicId del archivo')
            );
        }

        const result = await uploadServices.deleteFile(publicId, resourceType);

        return res.status(200).json(
            ResponseHandler.success(result, 'Archivo eliminado exitosamente')
        );
    } catch (error) {
        console.error('Error en deleteFile:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error al eliminar el archivo: ${error.message}`)
        );
    }
};

const getFileInfo = async (req, res, next) => {
    try {
        const { publicId } = req.params;
        const { resourceType = 'image' } = req.query;

        if (!publicId) {
            return res.status(400).json(
                ResponseHandler.error('Se requiere el publicId del archivo')
            );
        }

        const fileInfo = await uploadServices.getFileInfo(publicId, resourceType);

        return res.status(200).json(
            ResponseHandler.success(fileInfo, 'Información del archivo obtenida exitosamente')
        );
    } catch (error) {
        console.error('Error en getFileInfo:', error);
        return res.status(500).json(
            ResponseHandler.error(`Error al obtener información del archivo: ${error.message}`)
        );
    }
};

module.exports = {
    uploadFile,
    uploadImage,
    uploadVideo,
    deleteFile,
    getFileInfo
};