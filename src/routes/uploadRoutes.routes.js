const express = require('express');
const uploadControllers = require('../controllers/uploadControllers');
const { uploadFile, uploadImage, uploadVideo } = require('../middlewares/uploadMiddleware');
const { verifyToken } = require('../middlewares/index'); // Ajusta según tu middleware de autenticación
const router = express.Router();

// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
    if (err) {
        const ResponseHandler = require('../utils/responseHandler')
        return res.status(400).json(
            ResponseHandler.error(`Error al subir archivo: ${err.message}`)
        );
    }
    next();
};

// Ruta para subir cualquier tipo de archivo (imagen o video)
router.post('/',
    verifyToken, // Opcional: quitar si no necesitas autenticación
    uploadFile.single('file'),
    handleMulterError,
    uploadControllers.uploadFile
);

// Ruta específica para subir solo imágenes
router.post('/image',
    verifyToken, // Opcional: quitar si no necesitas autenticación
    uploadImage.single('image'),
    handleMulterError,
    uploadControllers.uploadImage
);

// Ruta específica para subir solo videos
router.post('/video',
    verifyToken, // Opcional: quitar si no necesitas autenticación
    uploadVideo.single('video'),
    handleMulterError,
    uploadControllers.uploadVideo
);

// Ruta para eliminar un archivo
router.delete('/',
    verifyToken, // Opcional: quitar si no necesitas autenticación
    uploadControllers.deleteFile
);

// Ruta para obtener información de un archivo
router.get('/:publicId',
    uploadControllers.getFileInfo
);

module.exports = router;