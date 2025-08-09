const express = require('express')
const matrizControllers = require('../controllers/matrizControllers')
const { verifyToken } = require('../middlewares/index')
const router = express.Router()

router.get('/:usuarioId', verifyToken, matrizControllers.obtenerMatrizUsuario)
router.post('/agregar-referido', verifyToken, matrizControllers.agregarReferidosMatriz)

module.exports = router