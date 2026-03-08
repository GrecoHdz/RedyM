const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");

const {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario
} = require("../controllers/UsuarioController");

// OBTENER TODOS LOS USUARIOS (READ ALL)
router.get("/", authMiddleware, obtenerUsuarios);

// OBTENER UN USUARIO POR ID (READ ONE)
router.get("/:id", authMiddleware, obtenerUsuarioPorId);

// CREAR USUARIO (CREATE)
router.post("/nuevo", crearUsuario);

// ACTUALIZAR USUARIO (UPDATE)
router.put("/:id", authMiddleware, actualizarUsuario);

// ELIMINAR USUARIO (DELETE)
router.delete("/:id", authMiddleware, eliminarUsuario);

module.exports = router;
