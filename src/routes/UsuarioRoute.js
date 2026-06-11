const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");

const {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    obtenerUsuarioByIdentidad,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    actualizarFotoPerfil,
    eliminarFotoPerfil,
    actualizarFotoIdentidad,
    eliminarFotoIdentidad,
    cambioClave,
    aprobarVerificacion,
    rechazarVerificacion
} = require("../controllers/UsuarioController");
const { uploadProfile, uploadIdentity } = require("../config/cloudinary");

// OBTENER TODOS LOS USUARIOS (READ ALL)
router.get("/", authMiddleware, obtenerUsuarios);

// OBTENER UN USUARIO POR ID (READ ONE)
router.get("/:id", authMiddleware, obtenerUsuarioPorId);

// BUSCAR POR IDENTIDAD (PARA REGALOS)
router.get("/identidad/:identidad", authMiddleware, obtenerUsuarioByIdentidad);

// CREAR USUARIO (CREATE)
router.post("/nuevo", crearUsuario);

// ACTUALIZAR USUARIO (UPDATE)
router.put("/:id", authMiddleware, actualizarUsuario);

// CAMBIAR CONTRASEÑA (PASSWORD)
router.put("/cambio-clave/:id", authMiddleware, cambioClave);

// ACTUALIZAR FOTO DE PERFIL (UPLOAD)
router.post("/imagen-perfil/:id", authMiddleware, uploadProfile.single('imagen'), actualizarFotoPerfil);
router.delete("/imagen-perfil/:id", authMiddleware, eliminarFotoPerfil);

// GESTIÓN DE FOTO DE IDENTIDAD
router.post("/identidad-foto/:id", authMiddleware, uploadIdentity.single('imagen'), actualizarFotoIdentidad);
router.delete("/identidad-foto/:id", authMiddleware, eliminarFotoIdentidad);

// GESTIÓN DE VERIFICACIÓN DE IDENTIDAD
router.put("/verificar/:id", authMiddleware, aprobarVerificacion);
router.put("/rechazar-verificacion/:id", authMiddleware, rechazarVerificacion);

// ELIMINAR USUARIO (DELETE)
router.delete("/:id", authMiddleware, eliminarUsuario);

module.exports = router;
