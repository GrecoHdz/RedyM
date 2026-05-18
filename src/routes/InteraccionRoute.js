const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { 
    registrarInteraccion,
    obtenerInteracciones,
    obtenerInteraccionesPorUsuario
} = require("../controllers/InteraccionController");

// REGISTRAR INTERACCIÓN
router.post("/", authMiddleware, registrarInteraccion);

// OBTENER INTERACCIONES POR PUBLICACIÓN
router.get("/:id_publicacion", obtenerInteracciones);
// OBTENER INTERACCIONES POR USUARIO
router.get("/usuario/:id_usuario", authMiddleware, obtenerInteraccionesPorUsuario);

module.exports = router;
