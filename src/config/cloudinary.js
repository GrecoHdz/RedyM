const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Configuración para perfiles
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'RedyMercadeo/usuarios/perfiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{
      width: 800,
      height: 800,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto:best',
      fetch_format: 'auto',
      format: 'webp',
      dpr: 'auto',
      effect: 'sharpen:100',
      flags: 'lossy',
      secure: true
    }],
    resource_type: 'image'
  }
});

// Configuración para paquetes
const packageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'RedyMercadeo/paquetes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{
      width: 1200,
      height: 900,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto:best',
      fetch_format: 'auto',
      format: 'webp',
      dpr: 'auto',
      effect: 'sharpen:100',
      flags: 'lossy',
      secure: true
    }],
    resource_type: 'image'
  }
});

// Middleware para subir imágenes de perfil
exports.uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Aumentado a 15MB para permitir mayor calidad
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten archivos de imagen (JPG, JPEG, PNG, WEBP)'), false);
    }
    cb(null, true);
  }
});

// Middleware para subir imágenes de paquetes
exports.uploadPackage = multer({
  storage: packageStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Aumentado a 15MB para permitir mayor calidad
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten archivos de imagen (JPG, JPEG, PNG, WEBP)'), false);
    }
    cb(null, true);
  }
});

// Configuración para identidad
const identityStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'RedyMercadeo/usuarios/identidad',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    quality: 'auto:best',
    fetch_format: 'auto',
    secure: true
  }
});

// Middleware para subir imágenes de identidad
exports.uploadIdentity = multer({
  storage: identityStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'), false);
    }
    cb(null, true);
  }
});

// Configuración para publicaciones (soporta imágenes y videos)
const postStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'RedyMercadeo/publicaciones',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi'],
    quality: 'auto:best',
    fetch_format: 'auto',
    secure: true,
    resource_type: 'auto' // Esto permite subir tanto imágenes como videos
  }
});

// Middleware para subir archivos de publicaciones
exports.uploadPost = multer({
  storage: postStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB según requerimiento
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes y videos'), false);
    }
  }
});

// Configuración para comprobantes de pago de publicaciones
const comprobanteStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'RedyMercadeo/publicaciones/comprobantes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    quality: 'auto:good',
    fetch_format: 'auto',
    secure: true,
    resource_type: 'image'
  }
});

exports.uploadComprobante = multer({
  storage: comprobanteStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes para el comprobante'), false);
    }
    cb(null, true);
  }
});

// Exportar la instancia de cloudinary para operaciones directas
exports.cloudinary = cloudinary;