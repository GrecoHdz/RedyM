const express = require("express");
const router = express.Router();
const { authMiddleware, checkRole } = require("../middlewares/authMiddleware");
const {
    crearSolicitud,
    listarSolicitudes,
    procesarSolicitud
} = require("../controllers/solicitudesUpgradeController");

// Crear solicitud de upgrade (Cliente/Usuario)
router.post("/", authMiddleware, crearSolicitud);

// Listar solicitudes (Admin)
router.get("/", authMiddleware, checkRole(['admin', 'sa']), listarSolicitudes);

// Procesar solicitud (Aprobar/Rechazar por Admin)
router.post("/procesar/:id", authMiddleware, checkRole(['admin', 'sa']), procesarSolicitud);

module.exports = router;
