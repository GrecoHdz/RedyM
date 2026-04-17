const Config = require("../models/configModel");

const obtenerConfigPublicaciones = async (req, res) => {
    try {
        const configs = await Config.findAll({
            where: {
                tipo_config: ['valor_like', 'valor_video', 'valor_encuesta']
            }
        });

        // Convertir a un objeto plano para el frontend
        const data = {};
        configs.forEach(c => {
            data[c.tipo_config] = c.valor;
        });

        // Valores por defecto si no existen
        if (!data.valor_like) data.valor_like = "0.10";
        if (!data.valor_video) data.valor_video = "1.50";
        if (!data.valor_encuesta) data.valor_encuesta = "2.50";

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al obtener config:", error);
        res.status(500).json({ success: false, message: "Error al obtener configuración" });
    }
};

module.exports = {
    obtenerConfigPublicaciones
};
