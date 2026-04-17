const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { 
    crearPublicacion, 
    obtenerPublicaciones, 
    eliminarPublicacion 
} = require("../controllers/PublicacionController");
const { uploadPost } = require("../config/cloudinary");

// OBTENER FEED
router.get("/", obtenerPublicaciones);

// CREAR PUBLICACIÓN (UPLOAD)
router.post("/", authMiddleware, uploadPost.array('media', 5), crearPublicacion);

// ELIMINAR PUBLICACIÓN
router.delete("/:id", authMiddleware, eliminarPublicacion);

module.exports = router;
