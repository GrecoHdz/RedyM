const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configuración de storage para imágenes de usuarios (comprimidas)
const userImageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'imagenes_usuarios',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [{
            width: 1200,
            height: 1200,
            crop: 'limit', // No corta, solo redimensiona si es más grande
            gravity: 'auto:subject',
            quality: 'auto:good', // Buena calidad pero optimizada
            fetch_format: 'auto',
            format: 'webp', // Convierte a WebP para mejor compresión
            dpr: 'auto'
        }]
    }
});

// Configuración de storage para videos de usuarios (comprimidos)
const userVideoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'videos_usuarios',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'],
        transformation: [{
            width: 1280,
            height: 720,
            crop: 'limit',
            quality: 'auto:good',
            video_codec: 'h264', // Codec eficiente
            audio_codec: 'aac',
            bit_rate: '1000k', // Bitrate optimizado
            format: 'mp4' // Formato estándar y comprimido
        }]
    }
});

// Configuración de storage para archivos generales (imágenes)
const generalImageStorage = new CloudinaryStorage({
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

// Configuración de storage para videos generales
const generalVideoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads/videos',
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm']
    }
});

// Storage dinámico que elige según el tipo de archivo (para usuarios)
const createUserStorage = () => {
    return {
        _handleFile: function (req, file, cb) {
            let storage;
            
            if (file.mimetype.startsWith('image/')) {
                storage = userImageStorage;
            } else if (file.mimetype.startsWith('video/')) {
                storage = userVideoStorage;
            } else {
                return cb(new Error('Tipo de archivo no permitido'), null);
            }
            
            storage._handleFile(req, file, cb);
        },
        _removeFile: function (req, file, cb) {
            // Implementar lógica de eliminación si es necesario
            cb(null);
        }
    };
};

// Storage dinámico general que elige según el tipo de archivo
const createGeneralStorage = () => {
    return {
        _handleFile: function (req, file, cb) {
            let storage;
            
            if (file.mimetype.startsWith('image/')) {
                storage = generalImageStorage;
            } else if (file.mimetype.startsWith('video/')) {
                storage = generalVideoStorage;
            } else {
                return cb(new Error('Tipo de archivo no permitido'), null);
            }
            
            storage._handleFile(req, file, cb);
        },
        _removeFile: function (req, file, cb) {
            cb(null);
        }
    };
};

// Middleware para subir múltiples archivos de usuarios
const uploadUserFiles = multer({
    storage: createUserStorage(),
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

// Middlewares individuales para compatibilidad
const uploadImage = multer({
    storage: generalImageStorage,
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

const uploadVideo = multer({
    storage: generalVideoStorage,
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
    storage: createGeneralStorage(),
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

// Configuraciones específicas del código original (mantener para compatibilidad)
const imageConfigs = {
    banner: {
        folder: 'Delivery/banners',
        transformation: [{
            width: 1200,
            height: 400,
            crop: 'fill',
            gravity: 'auto:subject',
            quality: 'auto',
            fetch_format: 'auto',
            format: 'webp',
            dpr: 'auto'
        }]
    },
    product: {
        folder: 'Delivery/products',
        transformation: [{
            width: 500,
            height: 500,
            crop: 'fill',
            gravity: 'auto:subject',
            quality: 'auto',
            fetch_format: 'auto',
            format: 'webp',
            dpr: 'auto'
        }],
        eager: [
            { width: 400, height: 400, crop: 'fill', gravity: 'auto:subject' }
        ]
    },
    store: {
        folder: 'Delivery/stores',
        transformation: [{
            width: 600,
            height: 400,
            crop: 'fill',
            gravity: 'auto:subject',
            quality: 'auto',
            fetch_format: 'auto',
            format: 'webp',
            dpr: 'auto'
        }],
        eager: [
            { width: 300, height: 200, crop: 'fill', gravity: 'auto:subject' }
        ]
    }
};

const createStorage = (type) => {
    try {
        if (!imageConfigs[type]) {
            throw new Error(`Tipo de imagen no configurado: ${type}`);
        }

        const params = {
            folder: imageConfigs[type].folder,
            resource_type: "image",
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            overwrite: true,
            unique_filename: true
        };

        if (imageConfigs[type].transformation) {
            params.transformation = imageConfigs[type].transformation;
        }

        if (imageConfigs[type].eager) {
            params.eager = imageConfigs[type].eager;
        }

        return new CloudinaryStorage({
            cloudinary: cloudinary,
            params: params
        });
    } catch (error) {
        console.error(`Error al crear storage para ${type}:`, error);
        return new CloudinaryStorage({
            cloudinary: cloudinary,
            params: {
                folder: `Delivery/${type}s`,
                resource_type: "image",
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                transformation: [{
                    width: 500,
                    height: 500,
                    crop: 'fill',
                    gravity: 'auto:subject',
                    quality: 'auto',
                    fetch_format: 'auto',
                    format: 'webp',
                    dpr: 'auto'
                }]
            }
        });
    }
};

// Mantener middlewares originales
const uploadBanner = multer({
    storage: createStorage('banner'),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten archivos de imagen'), false);
        }
        cb(null, true);
    }
});

const uploadProduct = multer({
    storage: createStorage('product'),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten archivos de imagen'), false);
        }
        cb(null, true);
    }
});

const uploadStore = multer({
    storage: createStorage('store'),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten archivos de imagen'), false);
        }
        cb(null, true);
    }
});

module.exports = {
    cloudinary,
    uploadFile, // Para archivos generales
    uploadImage, // Solo imágenes
    uploadVideo, // Solo videos
    uploadUserFiles, // Para publicaciones de usuarios
    uploadBanner,
    uploadProduct,
    uploadStore,
    createStorage
};