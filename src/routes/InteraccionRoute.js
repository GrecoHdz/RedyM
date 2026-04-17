const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { 
    registrarInteraccion,
    obtenerInteracciones
} = require("../controllers/InteraccionController");

// REGISTRAR INTERACCIÓN
router.post("/", authMiddleware, registrarInteraccion);

// OBTENER INTERACCIONES POR PUBLICACIÓN
router.get("/:id_publicacion", obtenerInteracciones);

module.exports = router;
