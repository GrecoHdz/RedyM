const ResponseHandler = require('../utils/responseHandler')
const db = require('../models')
const ConfiguracionSistema = db.ConfiguracionSistema

const getAllConfiguracionSistema = async () => {
    try {
        const configuracionSistema = await ConfiguracionSistema.findAll({
            attributes: {
                exclude: ['fechaActualizacion', 'createdAt', 'updatedAt']
            }
        })
        return ResponseHandler.success(configuracionSistema)
    } catch (error) {
        throw error
    }
}

const getConfiguracionSistemaById = async (id) => {
    try {
        const configuracionSistema = await ConfiguracionSistema.findOne({
            where: {
                configuracionId: id,
            },
            attributes: {
                exclude: ['fechaActualizacion', 'createdAt', 'updatedAt']
            }
        })
        return ResponseHandler.success(configuracionSistema)
    } catch (error) {
        throw error
    }
}

const createConfiguracionSistema = async (data) => {
    try {
        const configuracionSistema = await ConfiguracionSistema.create(data)
        return ResponseHandler.success(configuracionSistema, 'Configuracion del Sistema creado exitosamente')
    } catch (error) {
        throw error
    }
}

const updateConfiguracionSistema = async (data, id) => {
    try {
        const {
            precioSuscripcionNivel1,
            precioSuscripcionNivel2,
            precioSuscripcionNivel3,
            precioSuscripcionNivel4,
            precioSuscripcionNivel5,
            gananciasPorLike,
            gananciasPorCompartir,
            porcentajeComisionNivel,
            actualizadoPor
        } = data

        const configuracionSistema = await ConfiguracionSistema.update({
            precioSuscripcionNivel1: precioSuscripcionNivel1,
            precioSuscripcionNivel2: precioSuscripcionNivel2,
            precioSuscripcionNivel3: precioSuscripcionNivel3,
            precioSuscripcionNivel4: precioSuscripcionNivel4,
            precioSuscripcionNivel5: precioSuscripcionNivel5,
            gananciasPorLike: gananciasPorLike,
            gananciasPorCompartir: gananciasPorCompartir,
            porcentajeComisionNivel: porcentajeComisionNivel,
            actualizadoPor: actualizadoPor,
            fechaActualizacion: new Date(),
        }, {
            where: {
                configuracionId: id,
            }
        })
        return ResponseHandler.success(configuracionSistema, 'Configuracion del Sistema actualizado exitosamente')
    } catch (error) {
        throw error
    }
}

const deleteConfiguracionSistema = async (id) => {
    try {
        const configuracionSistema = await ConfiguracionSistema.destroy({
            where: {
                configuracionId: id,
            }
        })
        return ResponseHandler.success(configuracionSistema, 'Configuracion del Sistema eliminado exitosamente');
    } catch (error) {
        throw error
    }

}

module.exports = {
    getAllConfiguracionSistema,
    getConfiguracionSistemaById,
    createConfiguracionSistema,
    updateConfiguracionSistema,
    deleteConfiguracionSistema,
}