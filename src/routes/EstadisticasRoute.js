const express = require("express");
const router = express.Router();
const estadisticasController = require("../controllers/EstadisticasController");
const { authMiddleware, checkRole } = require("../middlewares/authMiddleware");

// Todas las rutas de estadísticas requieren ser administrador
router.get("/global", authMiddleware, estadisticasController.getGlobalStats);
router.get("/detalles", authMiddleware, estadisticasController.getKpiDetails);
router.get("/referidos/:id_usuario", authMiddleware, estadisticasController.getReferralNames);

module.exports = router;
