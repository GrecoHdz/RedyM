const express = require('express')
const configuracionSistemaControllers = require('../controllers/configuracionSistemaControllers')
const { verifyToken } = require('../middlewares/index')
const router = express.Router()
const { ValidationRules, validate } = require('../middlewares/validaciones/configuracionSistemaValidation')

router.get('/', verifyToken, configuracionSistemaControllers.getAllConfiguracionSistema)
router.get('/:id', verifyToken, configuracionSistemaControllers.getConfiguracionSistemaById)
router.post('/', [ValidationRules(), validate], configuracionSistemaControllers.createConfiguracionSistema)
router.put('/:id', [verifyToken, ValidationRules(), validate], configuracionSistemaControllers.updateConfiguracionSistema)
router.delete('/:id', verifyToken, configuracionSistemaControllers.deleteConfiguracionSistema)

module.exports = router