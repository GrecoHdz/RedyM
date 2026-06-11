const express = require("express");
const router = express.Router();
const { authMiddleware, checkRole } = require("../middlewares/authMiddleware");
const { apiLimiter } = require('../middlewares/rateLimiters'); 
const {
    getMisionesProgress,
    reclamarMisionAuto,
    getMisionesEspeciales,
    listarMisionesAdmin,
    crearMisionAdmin,
    actualizarMisionAdmin,
    eliminarMisionAdmin,
    reclamarMisionEspecial,
    getReclamos,
    procesarReclamo,
    getHistorialUsuario,
    finalizarMisionSeleccion,
    finalizarMisionEscrita,
    getMisionStats,
    procesarReclamosBulk,
    getMisionGanadores
} = require("../controllers/MisionController");

// User routes (require authentication)
router.get("/progreso", authMiddleware, apiLimiter, getMisionesProgress);
router.get("/progreso/:id_usuario", authMiddleware, apiLimiter, getMisionesProgress);
router.get("/historial", authMiddleware, apiLimiter, getHistorialUsuario);
router.get("/historial/:id_usuario", authMiddleware, apiLimiter, getHistorialUsuario);
router.post("/reclamar/auto", authMiddleware, apiLimiter, reclamarMisionAuto);
router.get("/especial", authMiddleware, apiLimiter, getMisionesEspeciales);
router.post("/especial/reclamar", authMiddleware, apiLimiter, reclamarMisionEspecial);

// Admin routes (require admin role) - specific routes first!
router.get("/admin/especiales", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, listarMisionesAdmin);
router.post("/admin/especiales", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, crearMisionAdmin);
router.put("/admin/especiales/:id", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, actualizarMisionAdmin);
router.delete("/admin/especiales/:id", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, eliminarMisionAdmin);
router.post("/admin/especiales/finalizar", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, finalizarMisionSeleccion);
router.post("/admin/especiales/finalizar-escrita", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, finalizarMisionEscrita);
router.get("/admin/especiales/:id/stats", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, getMisionStats);
router.get("/admin/especiales/:id/ganadores", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, getMisionGanadores);
router.post("/admin/especiales/reclamos/bulk", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, procesarReclamosBulk);
router.get("/reclamos", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, getReclamos);
router.put("/reclamos/:id", authMiddleware, checkRole(['admin', 'sa', 'Admin']), apiLimiter, procesarReclamo);

// User route to see ganadores (public view without sensitive data)
router.get("/especial/:id/ganadores", authMiddleware, apiLimiter, getMisionGanadores);

module.exports = router;
