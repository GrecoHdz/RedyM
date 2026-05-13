const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { 
    crearPublicacion, 
    registrarPago,
    obtenerPublicaciones,
    obtenerMisPublicaciones,
    obtenerPublicacionesPendientes,
    aprobarPago,
    rechazarPago,
    eliminarPublicacion 
} = require("../controllers/PublicacionController");
const { uploadPost } = require("../config/cloudinary");

// FEED PÚBLICO (solo activas)
router.get("/", obtenerPublicaciones);

// MIS PUBLICACIONES (del usuario autenticado - todas)
router.get("/mis-publicaciones/:id_usuario", authMiddleware, obtenerMisPublicaciones);

// ADMIN: publicaciones pendientes de verificación
router.get("/admin/pendientes", authMiddleware, obtenerPublicacionesPendientes);

// ADMIN: aprobar / rechazar pago
router.post("/admin/aprobar/:id_publicacion", authMiddleware, aprobarPago);
router.post("/admin/rechazar/:id_publicacion", authMiddleware, rechazarPago);

// CREAR PUBLICACIÓN
router.post("/", authMiddleware, uploadPost.array('media', 5), crearPublicacion);

// REGISTRAR PAGO (cliente envía N° comprobante)
router.post("/:id_publicacion/pago", authMiddleware, registrarPago);

// ELIMINAR PUBLICACIÓN
router.delete("/:id", authMiddleware, eliminarPublicacion);

module.exports = router;
