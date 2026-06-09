const express = require("express");
const router = express.Router();
const { authMiddleware, checkRole } = require("../middlewares/authMiddleware");
const {
    getMiRed,
    getHijosDeUsuario,
    getProgresoRed,
    unirseARed,
    subirNivel,
    actualizarRedCompleta,
    getProximoVencimientoRed
} = require("../controllers/redNivelesController");

// Obtener mi red (Dashboard)
router.get("/mi-red/:id_usuario", authMiddleware, getMiRed);

// Obtener la próxima fecha de vencimiento global de la red
router.get("/proximo-vencimiento", authMiddleware, checkRole(['admin', 'sa']), getProximoVencimientoRed);

// Obtener progreso de la agencia (Conteos por nivel)
router.get("/progreso/:id_usuario", authMiddleware, getProgresoRed);

// Obtener hijos para navegación recursiva
router.get("/hijos/:id_padre", authMiddleware, getHijosDeUsuario);

// Unirse a la red (Pago Nivel 1)
router.post("/unirse", authMiddleware, unirseARed);

// Subir de nivel (Upgrade)
router.post("/upgrade", authMiddleware, subirNivel);

// Reconstruir y sanar la red de niveles completa (Admin / Super Admin)
router.post("/rebuild", authMiddleware, checkRole(['admin', 'sa']), actualizarRedCompleta);

module.exports = router;
