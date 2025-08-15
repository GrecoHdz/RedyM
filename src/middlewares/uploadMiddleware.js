const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configuración de storage para imágenes
const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads/images',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [{
            width: 1000,
            height: 1000,
            crop: 'limit',
            quality: 'auto',
            fetch_format: 'auto'
        }]
    }
});

// Configuración de storage para videos
const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm']
    }
});

// Middleware para subir imágenes
const uploadImage = multer({
    storage: imageStorage,
    limits: { 
        fileSize: 10 * 1024 * 1024 // 10MB para imágenes
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten archivos de imagen'), false);
        }
        cb(null, true);
    }
});

// Middleware para subir videos
const uploadVideo = multer({
    storage: videoStorage,
    limits: { 
        fileSize: 100 * 1024 * 1024 // 100MB para videos
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('video/')) {
            return cb(new Error('Solo se permiten archivos de video'), false);
        }
        cb(null, true);
    }
});

// Middleware universal que acepta tanto imágenes como videos
const uploadFile = multer({
    storage: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, imageStorage);
        } else if (file.mimetype.startsWith('video/')) {
            cb(null, videoStorage);
        } else {
            cb(new Error('Tipo de archivo no permitido'), null);
        }
    },
    limits: { 
        fileSize: 100 * 1024 * 1024 // 100MB límite general
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen o video'), false);
        }
    }
});

module.exports = {
    uploadImage,
    uploadVideo,
    uploadFile,
    cloudinary
};