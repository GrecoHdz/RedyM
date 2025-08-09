const { Router } = require('express')

const router = Router();

const usuario = require('./usuario.routes')
const configuracionSistema = require('./configuracionSistema.routes')
const matriz = require('./matriz.routes')

router.use('/api/v1/usuario', usuario)
router.use('/api/v1/configuracionsistema', configuracionSistema)
router.use('/api/v1/matriz', matriz)

module.exports = router