const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
    getMiRed,
    getHijosDeUsuario,
    getProgresoRed,
    unirseARed,
    subirNivel
} = require("../controllers/redNivelesController");

// Obtener mi red (Dashboard)
router.get("/mi-red/:id_usuario", authMiddleware, getMiRed);

// Obtener progreso de la agencia (Conteos por nivel)
router.get("/progreso/:id_usuario", authMiddleware, getProgresoRed);

// Obtener hijos para navegación recursiva
router.get("/hijos/:id_padre", authMiddleware, getHijosDeUsuario);

// Unirse a la red (Pago Nivel 1)
router.post("/unirse", authMiddleware, unirseARed);

// Subir de nivel (Upgrade)
router.post("/upgrade", authMiddleware, subirNivel);

module.exports = router;
