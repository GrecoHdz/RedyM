const { cloudinary } = require('../middlewares/uploadMiddleware');

const uploadFile = async (file) => {
    try {
        // El archivo ya fue subido por multer-cloudinary
        // Solo necesitamos retornar la información del archivo
        const fileInfo = {
            url: file.path,
            publicId: file.filename,
            originalName: file.originalname,
            size: file.size,
            format: file.format || file.mimetype.split('/')[1],
            resourceType: file.resource_type || (file.mimetype.startsWith('video/') ? 'video' : 'image'),
            width: file.width,
            height: file.height,
            bytes: file.bytes
        };

        return fileInfo;
    } catch (error) {
        throw new Error(`Error al procesar el archivo: ${error.message}`);
    }
};

const deleteFile = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        
        if (result.result === 'ok') {
            return { deleted: true, publicId };
        } else {
            throw new Error('No se pudo eliminar el archivo');
        }
    } catch (error) {
        throw new Error(`Error al eliminar el archivo: ${error.message}`);
    }
};

const getFileInfo = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.api.resource(publicId, {
            resource_type: resourceType
        });
        
        return {
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            size: result.bytes,
            width: result.width,
            height: result.height,
            createdAt: result.created_at
        };
    } catch (error) {
        throw new Error(`Error al obtener información del archivo: ${error.message}`);
    }
};

module.exports = {
    uploadFile,
    deleteFile,
    getFileInfo
};