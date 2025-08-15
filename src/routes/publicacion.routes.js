const express = require('express');
const publicacionControllers = require('../controllers/publicacionController');
const { verifyToken } = require('../middlewares/index'); // Ajusta según tu middleware de autenticación
const ResponseHandler = require('../utils/responseHandler');

// Importar el middleware de upload
const multer = require('multer');
const { cloudinary } = require('../middlewares/uploadMiddleware');

// Configurar multer para manejar archivos en memoria
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 50 * 1024 * 1024, // 50MB por archivo
        files: 10 // Máximo 10 archivos
    },
    fileFilter: (req, file, cb) => {
        // Validar tipos permitidos
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen o video'), false);
        }
    }
});

const router = express.Router();

// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json(
                ResponseHandler.error('El archivo es demasiado grande. Máximo 50MB por archivo.')
            );
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json(
                ResponseHandler.error('Demasiados archivos. Máximo 10 archivos por publicación.')
            );
        }
        return res.status(400).json(
            ResponseHandler.error(`Error al subir archivo: ${err.message}`)
        );
    }
    
    if (err) {
        return res.status(400).json(
            ResponseHandler.error(`Error al procesar archivos: ${err.message}`)
        );
    }
    
    next();
};

// Middleware para validar campos obligatorios
const validatePublicacionFields = (req, res, next) => {
    const { usuarioId, tipoPublicacionId, titulo, descripcion } = req.body;
    
    if (!usuarioId || !tipoPublicacionId || !titulo || !descripcion) {
        return res.status(400).json(
            ResponseHandler.error('Todos los campos son obligatorios: usuarioId, tipoPublicacionId, titulo, descripcion')
        );
    }
    
    if (titulo.trim().length < 5) {
        return res.status(400).json(
            ResponseHandler.error('El título debe tener al menos 5 caracteres')
        );
    }
    
    if (descripcion.trim().length < 10) {
        return res.status(400).json(
            ResponseHandler.error('La descripción debe tener al menos 10 caracteres')
        );
    }
    
    next();
};

// Rutas

// Obtener todas las publicaciones (público, con paginación)
router.get('/', publicacionControllers.getAllPublicaciones);

// Obtener publicación por ID (público)
router.get('/:id', publicacionControllers.getPublicacionById);

// Obtener publicaciones por usuario (público)
router.get('/usuario/:usuarioId', publicacionControllers.getPublicacionesByUsuario);

// Crear publicación (requiere autenticación y archivos)
router.post('/', 
    verifyToken, // Autenticación requerida
    upload.array('adjuntos', 10), // Acepta hasta 10 archivos con el nombre 'adjuntos'
    handleMulterError, // Manejo de errores de multer
    validatePublicacionFields, // Validar campos obligatorios
    publicacionControllers.createPublicacion
);

// Eliminar publicación (requiere autenticación)
router.delete('/:id', 
    verifyToken, // Autenticación requerida
    publicacionControllers.deletePublicacion
);

module.exports = router;