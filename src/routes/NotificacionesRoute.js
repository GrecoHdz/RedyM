const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { apiLimiter } = require('../middlewares/rateLimiters');
const {
    obtenerTodas,
    obtenerPorUsuario,
    crearNotificacion,
    enviarNotificacion,
    marcarComoLeida,
    marcarNotificacionIndividual,
    guardarSuscripcionPush,
    eliminarSuscripcionPush,
    obtenerVapidKey
} = require("../controllers/NotificacionesController");

const validarErrores = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errores: errors.array() });
    }
    next();
};

// 📋 RUTAS DE NOTIFICACIONES
router.get("/", apiLimiter, obtenerTodas);

router.get("/usuario/:id_usuario", [
    param("id_usuario").isInt({ min: 1 }).withMessage("ID inválido"),
], validarErrores, authMiddleware, apiLimiter, obtenerPorUsuario);

router.post("/", [
    body("tipo").trim().notEmpty(),
    body("titulo").trim().notEmpty(),
    body("creado_por").trim().notEmpty(),
], validarErrores, authMiddleware, apiLimiter, crearNotificacion);

router.post("/enviar", [
    body("id_notificacion").optional().isInt({ min: 1 }),
    body("titulo").optional().isString(),
], validarErrores, enviarNotificacion);

router.put("/marcar/leidas", [
    body("id_usuario").isInt({ min: 1 }),
], validarErrores, authMiddleware, apiLimiter, marcarComoLeida);

router.put("/marcar/individual", [
    body("id_destinatario_notificacion").isInt({ min: 1 }),
], validarErrores, authMiddleware, apiLimiter, marcarNotificacionIndividual);

// Rutas Web Push
router.get("/vapid-key", obtenerVapidKey);
router.post("/suscripcion", authMiddleware, guardarSuscripcionPush);
router.delete("/suscripcion", authMiddleware, eliminarSuscripcionPush);

module.exports = router;
