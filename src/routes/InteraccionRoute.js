const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { 
    registrarInteraccion,
    obtenerInteracciones,
    obtenerInteraccionesPorUsuario,
    obtenerVistasPorUsuario
} = require("../controllers/InteraccionController");

// REGISTRAR INTERACCIÓN
router.post("/", authMiddleware, registrarInteraccion);

// OBTENER INTERACCIONES POR PUBLICACIÓN
router.get("/:id_publicacion", obtenerInteracciones);
// OBTENER INTERACCIONES POR USUARIO
router.get("/usuario/:id_usuario", authMiddleware, obtenerInteraccionesPorUsuario);
// OBTENER VISTAS POR USUARIO
router.get("/vistas/:id_usuario", authMiddleware, obtenerVistasPorUsuario);

module.exports = router;
