const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
    obtenerConfig,
    obtenerMultiplesConfigs,
    obtenerValorConfig,
    guardarConfig,
    eliminarConfig
} = require("../controllers/ConfigController");

// Rutas Públicas/Autenticadas
router.get("/", obtenerConfig);
router.get("/multi", obtenerMultiplesConfigs); // ?tipos=val1,val2
router.get("/valor/:tipo_config", obtenerValorConfig);

// Rutas Administrativas (Aquí podrías añadir un middleware de checkAdmin)
router.post("/guardar", authMiddleware, guardarConfig);
router.delete("/:id", authMiddleware, eliminarConfig);

module.exports = router;
