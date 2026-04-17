const Publicacion = require("../models/publicacionesModel");
const Usuario = require("../models/usuariosModel");
const { cloudinary } = require("../config/cloudinary");

const crearPublicacion = async (req, res) => {
    try {
        const { id_usuario, content, external_url, poll_data, whatsapp_active } = req.body;
        const files = req.files || [];

        // Validar usuario
        const usuario = await Usuario.findByPk(id_usuario);
        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        // Mapear archivos subidos
        const media = files.map(file => ({
            url: file.path,
            type: file.mimetype.startsWith('video/') ? 'video' : 'image',
            public_id: file.filename
        }));

        // Parse poll_data if it comes as a JSON string from client
        let parsedPoll = null;
        if (poll_data) {
            try {
                parsedPoll = typeof poll_data === 'string' ? JSON.parse(poll_data) : poll_data;
            } catch (e) {
                console.warn("Error parsing poll data", e);
            }
        }

        // Crear publicación
        const nuevaPublicacion = await Publicacion.create({
            id_usuario,
            content: content || "",
            external_url: external_url || null,
            poll_data: parsedPoll,
            whatsapp_active: whatsapp_active === 'true' || whatsapp_active === true,
            media: media, // El setter lo convierte a string JSON
            estado: 'activa'
        });

        res.status(201).json({
            success: true,
            message: "Publicación creada con éxito",
            data: nuevaPublicacion
        });

    } catch (error) {
        console.error("Error al crear publicación:", error);
        res.status(500).json({ success: false, message: "Error interno al crear publicación" });
    }
};

const obtenerPublicaciones = async (req, res) => {
    try {
        const publicaciones = await Publicacion.findAll({
            where: { estado: 'activa' },
            include: [{
                model: Usuario,
                as: 'usuario',
                attributes: ['id_usuario', 'nombre', 'imagen_url', 'verificado', 'telefono']
            }],
            order: [['fecha', 'DESC']]
        });

        res.json({ success: true, data: publicaciones });
    } catch (error) {
        console.error("Error al obtener publicaciones:", error);
        res.status(500).json({ success: false, message: "Error al obtener feed" });
    }
};

const eliminarPublicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const publicacion = await Publicacion.findByPk(id);

        if (!publicacion) {
            return res.status(404).json({ success: false, message: "Publicación no encontrada" });
        }

        // Eliminar archivos de cloudinary
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
    obtenerPublicaciones,
    eliminarPublicacion
};
