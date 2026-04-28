const Config = require("../models/configModel");
const Usuario = require("../models/usuariosModel");
const { Op } = require('sequelize');

/**
 * Obtener todas las configuraciones en formato de lista
 */
const obtenerConfig = async (req, res) => {
    try {
        const config = await Config.findAll();
        res.json({ success: true, data: config });
    } catch (error) {
        console.error("Error al obtener configuraciones:", error);
        res.status(500).json({ 
            success: false,
            error: "Error al obtener configuraciones",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtener múltiples configuraciones por tipos en un solo objeto (Ideal para el Frontend)
 * Ejemplo: /config/multi?tipos=valor_membresia,nivel2_costo,valor_like
 */
const obtenerMultiplesConfigs = async (req, res) => {
    try {
        const { tipos } = req.query;
        if (!tipos) {
            return res.status(400).json({ success: false, error: "Debe proporcionar los tipos de configuración" });
        }

        const listaTipos = tipos.split(',');
        const configs = await Config.findAll({
            where: { tipo_config: { [Op.in]: listaTipos } }
        });

        const data = {};
        configs.forEach(c => {
            data[c.tipo_config] = c.valor;
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error en obtenerMultiplesConfigs:", error);
        res.status(500).json({ success: false, error: "Error al obtener configuraciones múltiples" });
    }
};

/**
 * Obtener valor de una configuración específica
 */
const obtenerValorConfig = async (req, res) => {
    try {
        const { tipo_config } = req.params;
        
        // Caso especial para el referidor predeterminado que necesita el JOIN con Usuario
        if (tipo_config === 'referidor_predeterminado') {
            const config = await Config.findOne({
                where: { tipo_config },
                include: [{
                    model: Usuario,
                    as: 'referidorPredeterminado', // Nombre de la asociación en models/index.js
                    attributes: ['id_usuario', 'nombre', 'email']
                }]
            });
            return res.json({ success: true, data: config });
        }
        
        const config = await Config.findOne({ where: { tipo_config } });
        res.json({ success: true, data: config });
    } catch (error) {
        console.error("Error al obtener valor de configuracion:", error);
        res.status(500).json({ success: false, error: "Error al obtener valor de configuracion" });
    }
};

/**
 * Crear o Actualizar configuración
 */
const guardarConfig = async (req, res) => {
    try {
        const { tipo_config, valor } = req.body;
        
        const [config, created] = await Config.findOrCreate({
            where: { tipo_config },
            defaults: { valor }
        });

        if (!created) {
            await config.update({ valor });
        }

        res.json({ success: true, data: config, action: created ? 'created' : 'updated' });
    } catch (error) {
        console.error("Error al guardar configuracion:", error);
        res.status(500).json({ success: false, error: "Error al procesar configuracion" });
    }
};

/**
 * Eliminar configuración
 */
const eliminarConfig = async (req, res) => {
    try {
        const { id } = req.params;
        await Config.destroy({ where: { id_config: id } });
        res.json({ success: true, message: "Configuración eliminada correctamente" });
    } catch (error) {
        console.error("Error al eliminar configuracion:", error);
        res.status(500).json({ success: false, error: "Error al eliminar configuracion" });
    }
};

module.exports = {
    obtenerConfig,
    obtenerMultiplesConfigs,
    obtenerValorConfig,
    guardarConfig,
    eliminarConfig
};
