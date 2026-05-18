const Interaccion = require("../models/InteraccionModel");
const Publicacion = require("../models/publicacionesModel");
const Usuario = require("../models/usuariosModel");
const Config = require("../models/configModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");
const Membresia = require("../models/membresiaModel");

const registrarInteraccion = async (req, res) => {
    try {
        const { id_publicacion, id_usuario, tipo, detalle } = req.body;

        if (!id_publicacion || !id_usuario || !tipo) {
            return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
        }

        // Obtener configuración de pagos de la tabla config
        const configs = await Config.findAll({
            where: {
                tipo_config: [
                    'valor_like', 
                    'valor_video', 
                    'valor_encuesta',
                    'valor_visita_web',
                    'valor_visita_whatsapp',
                    'valor_compartir'
                ]
            }
        });

        const valorLike = parseFloat(configs.find(c => c.tipo_config === 'valor_like')?.valor || 0.10);
        const valorVideo = parseFloat(configs.find(c => c.tipo_config === 'valor_video')?.valor || 1.50);
        const valorEncuesta = parseFloat(configs.find(c => c.tipo_config === 'valor_encuesta')?.valor || 2.50);
        const valorWeb = parseFloat(configs.find(c => c.tipo_config === 'valor_visita_web')?.valor || 0.10);
        const valorWa = parseFloat(configs.find(c => c.tipo_config === 'valor_visita_whatsapp')?.valor || 0.10);
        const valorShare = parseFloat(configs.find(c => c.tipo_config === 'valor_compartir')?.valor || 0.20);

        // Verificar si el usuario tiene membresía activa para el multiplicador x2
        const membresia = await Membresia.findOne({
            where: { id_usuario: id_usuario, estado: 'activa' }
        });
        const multiplicador = membresia ? 2 : 1;

        // Si es un like, verificamos si ya existe para evitar duplicados (comportamiento Toggle)
        if (tipo === 'like') {
            const existeLike = await Interaccion.findOne({
                where: { id_publicacion, id_usuario, tipo: 'like' }
            });

            if (existeLike) {
                 // Si ya existe, lo quitamos (Toggle like behavior)
                 const montoARestar = parseFloat(existeLike.monto_ganado || 0);
                 await existeLike.destroy();
                 
                 const pub = await Publicacion.findByPk(id_publicacion);
                 if (pub) {
                     await pub.decrement('likes');
                     if (pub.total_interacciones > 0) await pub.decrement('total_interacciones');
                     const costoInteraccion = montoARestar * 2;
                     const presupuestoActual = parseFloat(pub.presupuesto_restante || 0);
                     const presupuestoMax = parseFloat(pub.presupuesto || 0);
                     await pub.update({ 
                         presupuesto_restante: Math.min(presupuestoMax, presupuestoActual + costoInteraccion).toFixed(2),
                         estado: 'activa'
                     });
                 }

                 const creditoExistente = await CreditoUsuario.findOne({ where: { id_usuario } });
                 if (creditoExistente) {
                     const nuevoMonto = parseFloat(creditoExistente.monto_credito) - montoARestar;
                     await CreditoUsuario.upsert({
                         id_usuario,
                         monto_credito: Math.max(0, nuevoMonto).toFixed(2),
                         fecha: new Date()
                     });
                 }

                 return res.json({ success: true, message: "Like retirado", action: 'unliked' });
            }
        } else {
            // Para cualquier otro tipo de interacción, solo permitimos UNA por usuario/publicación
            const existeInteraccion = await Interaccion.findOne({
                where: { id_publicacion, id_usuario, tipo }
            });

            if (existeInteraccion) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Ya has realizado esta interacción (${tipo}) en esta publicación anteriormente.`,
                    already_done: true 
                });
            }
        }

        // Determinar recompensa antes de crear la interacción para guardarla en el registro
        let recompensa = 0;
        if (tipo === 'like') {
            recompensa = valorLike * multiplicador;
        } else if (tipo === 'video_view') {
            recompensa = valorVideo * multiplicador;
        } else if (tipo === 'share') {
            recompensa = valorShare * multiplicador;
        } else if (tipo === 'visita_web') {
            recompensa = valorWeb * multiplicador;
        } else if (tipo === 'visita_whatsapp') {
            recompensa = valorWa * multiplicador;
        } else if (tipo === 'poll') {
            const pub = await Publicacion.findByPk(id_publicacion);
            if (pub && pub.poll_data) {
                try {
                    const parsedDetalle = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
                    const correctOption = pub.poll_data.options[pub.poll_data.correct_index];
                    if (parsedDetalle && parsedDetalle.answer === correctOption) {
                        recompensa = valorEncuesta * multiplicador;
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

        // Actualizar contador de likes
        if (tipo === 'like') {
            const pub = await Publicacion.findByPk(id_publicacion);
            if (pub) await pub.increment('likes');
        }

        // --- LÓGICA DE PRESUPUESTO ---
        // Costo total = recompensa × 2 (50% al usuario, 50% a la plataforma)
        // Se descuenta del presupuesto_restante de la publicación
        if (recompensa > 0) {
            const pub = await Publicacion.findByPk(id_publicacion);
            if (pub) {
                const costoTotal = recompensa * 2; // 50% usuario + 50% plataforma
                const presupuestoActual = parseFloat(pub.presupuesto_restante || 0);
                const nuevoPresupuesto = Math.max(0, presupuestoActual - costoTotal);

                await pub.increment('total_interacciones');

                if (nuevoPresupuesto <= 0) {
                    // Presupuesto agotado: marcar publicación como finalizada/borrada
                    await pub.update({ 
                        presupuesto_restante: 0,
                        estado: 'borrada',
                        fecha_finalizacion: new Date()
                    });
                } else {
                    await pub.update({ presupuesto_restante: nuevoPresupuesto.toFixed(2) });
                }
            }
        }

        // Acreditar la recompensa (50%) al usuario interactuante
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

const obtenerInteraccionesPorUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const interacciones = await Interaccion.findAll({
            where: { id_usuario },
            include: [
                {
                    model: Publicacion,
                    as: 'publicacion',
                    attributes: ['content', 'media'],
                    include: [
                        {
                            model: Usuario,
                            as: 'usuario',
                            attributes: ['nombre']
                        }
                    ]
                }
            ],
            order: [['fecha', 'DESC']]
        });
        res.json({ success: true, data: interacciones });
    } catch (error) {
        console.error("Error al obtener interacciones por usuario:", error);
        res.status(500).json({ success: false, message: "Error al obtener historial" });
    }
};

module.exports = {
    registrarInteraccion,
    obtenerInteracciones,
    obtenerInteraccionesPorUsuario
};
