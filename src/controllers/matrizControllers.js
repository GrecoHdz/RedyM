const matrizServices = require('../services/matrizServices')

const agregarReferidosMatriz = async (req, res, next) => {
    const {
        referenteId,
        referidos,
        esForzado
    } = req.body
    
    const data = {
        referenteId,
        referidos,
        esForzado
    }
    
    try {
        const resultado = await matrizServices.agregarReferidosMatriz(data)
        return res.status(200).json(resultado)
    } catch (error) {
        next(error)
    }
}

const obtenerMatrizUsuario = async (req, res, next) => {
    const usuarioId = req.params.usuarioId;
    
    try {
        const matriz = await matrizServices.obtenerMatrizUsuario(usuarioId)
        return res.status(200).json(matriz)
    } catch (error) {
        next(error)
    }
}

module.exports = {
    agregarReferidosMatriz,
    obtenerMatrizUsuario,
}