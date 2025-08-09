const matrizRepository = require('../repositories/matrizRepository')

const agregarReferidosMatriz = async (data) => {
    try {
        const matriz = await matrizRepository.agregarReferidosMatriz(data)
        return (matriz) ? matriz : []
    } catch (error) {
        throw error
    }
}

const obtenerMatrizUsuario = async (matrizId) => {
    try {
        const matriz = await matrizRepository.obtenerMatrizUsuario(matrizId)
        return (matriz) ? matriz : []
    } catch (error) {
        throw error
    }
}

module.exports = {
    agregarReferidosMatriz,
    obtenerMatrizUsuario
}