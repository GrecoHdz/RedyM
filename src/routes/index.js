const { Router } = require('express')

const router = Router();

const usuario = require('./usuario.routes')
const configuracionSistema = require('./configuracionSistema.routes')
const matriz = require('./matriz.routes')
const uploadRoutes = require('./uploadRoutes.routes');
const publicacionRoutes = require('./publicacion.routes');

router.use('/api/v1/usuario', usuario)
router.use('/api/v1/configuracionsistema', configuracionSistema)
router.use('/api/v1/matriz', matriz)
router.use('/api/v1/upload', uploadRoutes)
router.use('/api/v1/publicacion', publicacionRoutes)

module.exports = router