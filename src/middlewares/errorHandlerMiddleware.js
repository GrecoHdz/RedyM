const ResponseHandler = require('../utils/responseHandler')
const errorHandlerMiddleware = (err, req, res, next) => {

    // Verifica si es un error de Foreign Key
    if (err.message && err.message.includes('foreign key constraint fails')) {
        return res.status(400).json(
            ResponseHandler.error(
                `No se puede eliminar el registro porque está siendo utilizado en otra parte del sistema. ${err.message}`
            )
        )
    }

    // Valores por defecto
    const status = err.status || 500
    const message = err.message || 'Servicio no disponible'

    // Respuesta genérica para otros errores
    return res.status(status).json(
        ResponseHandler.error(message)
    )
}

module.exports = errorHandlerMiddleware