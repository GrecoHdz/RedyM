const express = require("express");
const router = express.Router();
const { obtenerConfigPublicaciones } = require("../controllers/ConfigController");

router.get("/publicaciones", obtenerConfigPublicaciones);

module.exports = router;
