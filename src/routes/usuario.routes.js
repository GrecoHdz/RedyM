const express = require('express')
const usuarioControllers = require('../controllers/usuarioControllers')
const { verifyToken } = require('../middlewares/index')
const router = express.Router()
const { ValidationRules, validate } = require('../middlewares/validaciones/usuarioValidation')

router.get('/', verifyToken, usuarioControllers.getAllUsuario)
router.get('/:id', verifyToken, usuarioControllers.getUsuarioById)
router.post('/login', usuarioControllers.login)
router.post('/logout', usuarioControllers.logout)
router.post('/', [ValidationRules(), validate], usuarioControllers.createUsuario)
router.put('/:id', [verifyToken, ValidationRules(), validate], usuarioControllers.updateUsuario)
router.delete('/:id', verifyToken, usuarioControllers.deleteUsuario)

module.exports = router