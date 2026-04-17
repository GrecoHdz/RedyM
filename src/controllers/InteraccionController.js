const Interaccion = require("../models/InteraccionModel");
const Publicacion = require("../models/publicacionesModel");
const Usuario = require("../models/usuariosModel");
const Config = require("../models/configModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");

const registrarInteraccion = async (req, res) => {
    try {
        const { id_publicacion, id_usuario, tipo, detalle } = req.body;

        if (!id_publicacion || !id_usuario || !tipo) {
            return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
        }

        // Obtener configuración de pagos de la tabla config
        const configs = await Config.findAll({
            where: {
                tipo_config: ['valor_like', 'valor_video', 'valor_encuesta']
            }
        });

        const valorLike = parseFloat(configs.find(c => c.tipo_config === 'valor_like')?.valor || 0.10);
        const valorVideo = parseFloat(configs.find(c => c.tipo_config === 'valor_video')?.valor || 1.50);
        const valorEncuesta = parseFloat(configs.find(c => c.tipo_config === 'valor_encuesta')?.valor || 2.50);

        // Si es un like, verificamos si ya existe para evitar duplicados
        if (tipo === 'like') {
            const existeLike = await Interaccion.findOne({
                where: { id_publicacion, id_usuario, tipo: 'like' }
            });

            if (existeLike) {
                 // Si ya existe, lo quitamos (Toggle like behavior)
                 await existeLike.destroy();
                 
                 // Decrementar likes en la publicación
                 const pub = await Publicacion.findByPk(id_publicacion);
                 if (pub) {
                     await pub.decrement('likes');
                 }

                 // Decrementar saldo en la tabla dedicada
                 const creditoExistente = await CreditoUsuario.findOne({ where: { id_usuario } });
                 if (creditoExistente) {
                     const nuevoMonto = parseFloat(creditoExistente.monto_credito) - valorLike;
                     await CreditoUsuario.upsert({
                         id_usuario,
                         monto_credito: Math.max(0, nuevoMonto).toFixed(2),
                         fecha: new Date()
                     });
                 }

                 return res.json({ success: true, message: "Like retirado", action: 'unliked' });
            }
        }

        // Determinar recompensa antes de crear la interacción para guardarla en el registro
        let recompensa = 0;
        if (tipo === 'like') {
            recompensa = valorLike;
        } else if (tipo === 'video_view') {
            recompensa = valorVideo;
        } else if (tipo === 'poll') {
            const pub = await Publicacion.findByPk(id_publicacion);
            if (pub && pub.poll_data) {
                try {
                    const parsedDetalle = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
                    const correctOption = pub.poll_data.options[pub.poll_data.correct_index];
                    if (parsedDetalle && parsedDetalle.answer === correctOption) {
                        recompensa = valorEncuesta;
                    }
                } catch (e) {
                    console.warn("Error parsing detail for poll reward", e);
                }
            }
        }

        // Crear la interacción con el monto ganado registrado
        const nuevaInteraccion = await Interaccion.create({
            id_publicacion,
            id_usuario,
            tipo,
            detalle: detalle || null,
            monto_ganado: recompensa
        });

        // Actualizar contadores y saldo
        if (tipo === 'like') {
            const pub = await Publicacion.findByPk(id_publicacion);
            if (pub) await pub.increment('likes');
        }

        if (recompensa !== 0) {
            const creditoExistente = await CreditoUsuario.findOne({ where: { id_usuario } });
            let montoFinal = recompensa;
            if (creditoExistente) {
                montoFinal += parseFloat(creditoExistente.monto_credito);
            }
            
            await CreditoUsuario.upsert({
                id_usuario,
                monto_credito: parseFloat(montoFinal.toFixed(2)),
                fecha: new Date()
            });
        }

        res.status(201).json({
            success: true,
            message: "Interacción registrada",
            data: nuevaInteraccion,
            action: 'liked'
        });

    } catch (error) {
        console.error("Error al registrar interacción:", error);
        res.status(500).json({ success: false, message: "Error al procesar interacción" });
    }
};

const obtenerInteracciones = async (req, res) => {
    try {
        const { id_publicacion } = req.params;
        const interacciones = await Interaccion.findAll({
            where: { id_publicacion }
        });
        res.json({ success: true, data: interacciones });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al obtener interacciones" });
    }
};

module.exports = {
    registrarInteraccion,
    obtenerInteracciones
};
