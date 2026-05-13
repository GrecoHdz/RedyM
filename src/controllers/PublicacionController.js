const { Op } = require("sequelize");
const Publicacion = require("../models/publicacionesModel");
const Usuario = require("../models/usuariosModel");
const Interaccion = require("../models/InteraccionModel");
const { cloudinary } = require("../config/cloudinary");

const crearPublicacion = async (req, res) => {
    try {
        const { id_usuario, content, external_url, poll_data, whatsapp_active, whatsapp_number, presupuesto } = req.body;
        const files = req.files || [];

        const usuario = await Usuario.findByPk(id_usuario);
        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        const presupuestoNum = parseFloat(presupuesto || 0);
        if (presupuestoNum < 50) {
            return res.status(400).json({ success: false, message: "El presupuesto mínimo es L. 50" });
        }

        const media = files.map(file => ({
            url: file.path,
            type: file.mimetype.startsWith('video/') ? 'video' : 'image',
            public_id: file.filename
        }));

        let parsedPoll = null;
        if (poll_data) {
            try {
                parsedPoll = typeof poll_data === 'string' ? JSON.parse(poll_data) : poll_data;
            } catch (e) {
                console.warn("Error parsing poll data", e);
            }
        }

        // Estado inicial: pendiente_pago (no se muestra en el feed hasta que el admin apruebe)
        const nuevaPublicacion = await Publicacion.create({
            id_usuario,
            content: content || "",
            external_url: external_url || null,
            poll_data: parsedPoll,
            whatsapp_active: whatsapp_active === 'true' || whatsapp_active === true,
            whatsapp_number: whatsapp_number || null,
            media: media,
            estado: 'pendiente_pago',
            presupuesto: presupuestoNum.toFixed(2),
            presupuesto_restante: presupuestoNum.toFixed(2),
            total_interacciones: 0
        });

        res.status(201).json({
            success: true,
            message: "Publicación creada. Procede a registrar el pago.",
            data: nuevaPublicacion
        });

    } catch (error) {
        console.error("Error al crear publicación:", error);
        res.status(500).json({ success: false, message: "Error interno al crear publicación" });
    }
};

// Cliente sube comprobante de pago para una publicación
const registrarPago = async (req, res) => {
    try {
        const { id_publicacion } = req.params;
        const { id_cuenta_pago, num_comprobante } = req.body;

        const pub = await Publicacion.findByPk(id_publicacion);
        if (!pub) {
            return res.status(404).json({ success: false, message: "Publicación no encontrada" });
        }

        if (pub.estado !== 'pendiente_pago' && pub.estado !== 'rechazada') {
            return res.status(400).json({ success: false, message: "Esta publicación ya tiene un pago en proceso" });
        }

        await pub.update({
            id_cuenta_pago: id_cuenta_pago || null,
            num_comprobante: num_comprobante || null,
            estado: 'verificando_pago'
        });

        res.json({ success: true, message: "Pago registrado. En revisión.", data: pub });
    } catch (error) {
        console.error("Error al registrar pago:", error);
        res.status(500).json({ success: false, message: "Error al registrar pago" });
    }
};

const obtenerPublicaciones = async (req, res) => {
    try {
        const { uid } = req.query;

        const whereCondition = { estado: 'activa' };
        if (uid) {
            whereCondition.id_usuario = { [Op.ne]: uid };
        }

        const publicaciones = await Publicacion.findAll({
            where: whereCondition,
            include: [{
                model: Usuario,
                as: 'usuario',
                attributes: ['id_usuario', 'nombre', 'imagen_url', 'verificado', 'telefono']
            }, {
                model: Interaccion,
                as: 'interacciones',
                where: uid ? { id_usuario: uid } : { id_usuario: -1 },
                required: false
            }],
            order: [['fecha', 'DESC']]
        });

        const data = publicaciones.map(p => {
            const pub = p.toJSON();
            pub.liked = pub.interacciones?.some(i => i.tipo === 'like') || false;
            pub.answered = pub.interacciones?.some(i => i.tipo === 'poll') || false;
            pub.videoCompleted = pub.interacciones?.some(i => i.tipo === 'video_view') || false;
            delete pub.interacciones;
            return pub;
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al obtener publicaciones:", error);
        res.status(500).json({ success: false, message: "Error al obtener feed" });
    }
};

// Mis publicaciones (todas, incluyendo pendientes)
const obtenerMisPublicaciones = async (req, res) => {
    try {
        const { id_usuario } = req.params;

        const publicaciones = await Publicacion.findAll({
            where: { id_usuario },
            include: [{
                model: Interaccion,
                as: 'interacciones',
                required: false,
                attributes: ['id_interaccion', 'tipo', 'monto_ganado', 'fecha']
            }],
            order: [['fecha', 'DESC']]
        });

        const data = publicaciones.map(p => {
            const pub = p.toJSON();
            pub.total_interacciones_count = pub.interacciones ? pub.interacciones.length : 0;
            delete pub.interacciones;
            return pub;
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al obtener mis publicaciones:", error);
        res.status(500).json({ success: false, message: "Error al obtener publicaciones" });
    }
};

// Admin: obtener publicaciones pendientes de verificación
const obtenerPublicacionesPendientes = async (req, res) => {
    try {
        const publicaciones = await Publicacion.findAll({
            where: { estado: 'verificando_pago' },
            include: [{
                model: Usuario,
                as: 'usuario',
                attributes: ['id_usuario', 'nombre', 'imagen_url', 'telefono']
            }],
            order: [['fecha', 'DESC']]
        });

        res.json({ success: true, data: publicaciones });
    } catch (error) {
        console.error("Error al obtener publicaciones pendientes:", error);
        res.status(500).json({ success: false, message: "Error al obtener pendientes" });
    }
};

// Admin: aprobar pago → activar publicación
const aprobarPago = async (req, res) => {
    try {
        const { id_publicacion } = req.params;
        const pub = await Publicacion.findByPk(id_publicacion);

        if (!pub) return res.status(404).json({ success: false, message: "Publicación no encontrada" });

        await pub.update({ estado: 'activa' });

        res.json({ success: true, message: "Publicación activada correctamente" });
    } catch (error) {
        console.error("Error al aprobar pago:", error);
        res.status(500).json({ success: false, message: "Error al aprobar" });
    }
};

// Admin: rechazar pago → vuelve a pendiente_pago
const rechazarPago = async (req, res) => {
    try {
        const { id_publicacion } = req.params;
        const pub = await Publicacion.findByPk(id_publicacion);

        if (!pub) return res.status(404).json({ success: false, message: "Publicación no encontrada" });

        await pub.update({
            estado: 'rechazada',
            num_comprobante: null,
            id_cuenta_pago: null
        });

        res.json({ success: true, message: "Pago rechazado" });
    } catch (error) {
        console.error("Error al rechazar pago:", error);
        res.status(500).json({ success: false, message: "Error al rechazar" });
    }
};

const eliminarPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const publicacion = await Publicacion.findByPk(id);

        if (!publicacion) {
            return res.status(404).json({ success: false, message: "Publicación no encontrada" });
        }

        if (publicacion.media && publicacion.media.length > 0) {
            for (const item of publicacion.media) {
                const resourceType = item.type === 'video' ? 'video' : 'image';
                await cloudinary.uploader.destroy(item.public_id, { resource_type: resourceType });
            }
        }

        await publicacion.destroy();

        res.json({ success: true, message: "Publicación eliminada correctamente" });

    } catch (error) {
        console.error("Error al eliminar publicación:", error);
        res.status(500).json({ success: false, message: "Error al eliminar" });
    }
};

module.exports = {
    crearPublicacion,
    registrarPago,
    obtenerPublicaciones,
    obtenerMisPublicaciones,
    obtenerPublicacionesPendientes,
    aprobarPago,
    rechazarPago,
    eliminarPublicacion
};
