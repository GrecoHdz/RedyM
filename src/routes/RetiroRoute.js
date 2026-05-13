const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
    crearRetiro,
    obtenerRetirosUsuario,
    obtenerTodosLosRetiros,
    actualizarEstadoRetiro
} = require("../controllers/RetiroController");

// Middlewares
router.use(authMiddleware);
router.use(apiLimiter);

// Rutas
router.post("/", crearRetiro);
router.get("/usuario/:id_usuario", obtenerRetirosUsuario);
router.get("/", obtenerTodosLosRetiros); // Para admin
router.put("/:id/estado", actualizarEstadoRetiro); // Para admin

module.exports = router;
