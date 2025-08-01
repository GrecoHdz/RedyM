const { Router } = require('express')

const router = Router();

const usuario = require('./usuario.routes')
const configuracionSistema = require('./configuracionSistema.routes')

router.use('/api/v1/usuario', usuario)
router.use('/api/v1/configuracionsistema', configuracionSistema)

module.exports = router