const logErrorHandlerMiddleware = (error, req, res, next) => {
    console.log('Error en local:', error)
    next(error);
}
module.exports = logErrorHandlerMiddleware;