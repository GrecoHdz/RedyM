const { Op } = require("sequelize");
const Publicacion = require("../models/publicacionesModel");
const Usuario = require("../models/usuariosModel");
const Rol = require("../models/rolesModel");
const Ciudad = require("../models/ciudadesModel");
const Interaccion = require("../models/InteraccionModel");
const { cloudinary } = require("../config/cloudinary");

// Función auxiliar para extraer edad desde el DNI (Formato: XXXX-YYYY-ZZZZZ)
const obtenerEdadDesdeIdentidad = (identidad) => {
    if (!identidad) return null;
    // Limpiar guiones si existen
    const idLimpia = identidad.replace(/-/g, '');
    if (idLimpia.length < 8) return null;
    
    // El año de nacimiento son los dígitos del 5 al 8 (índice 4 al 7)
    // Ejemplo: 0801-1990-12345 -> 1990
    const anioStr = idLimpia.substring(4, 8);
    const anioNacimiento = parseInt(anioStr);
    
    if (isNaN(anioNacimiento)) return null;
    
    const anioActual = new Date().getFullYear();
    return anioActual - anioNacimiento;
};

const crearPublicacion = async (req, res) => {
    try {
        const { 
            id_usuario, content, external_url, poll_data, 
            whatsapp_active, whatsapp_number, presupuesto,
            target_id_ciudad, target_genero, target_edad_min, target_edad_max 
        } = req.body;
        const files = req.files || [];

        const usuario = await Usuario.findByPk(id_usuario, {
            include: [{ model: Rol, as: 'rol' }]
        });
        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        const rolName = usuario.rol?.nombre_rol?.toLowerCase();
        const isAdmin = rolName === 'sa' || rolName === 'admin';

        const presupuestoNum = parseFloat(presupuesto || 0);
        
        // El presupuesto mínimo es 50 solo para usuarios normales
        if (!isAdmin && presupuestoNum < 50) {
            return res.status(400).json({ success: false, message: "El presupuesto mínimo es L. 50" });
        }

        // Para admins, si no ponen presupuesto o es 0, les ponemos uno simbólico muy alto para que no se agote
        // o simplemente lo que hayan puesto si es >= 0.
        let finalPresupuesto = presupuestoNum;
        if (isAdmin && presupuestoNum <= 0) {
            finalPresupuesto = 999999.00; // Presupuesto "infinito" para admins
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
                console.error("Error parsing poll data:", e);
            }
        }

        const nuevaPub = await Publicacion.create({
            id_usuario,
            content,
            external_url,
            poll_data: parsedPoll,
            media,
            whatsapp_active: whatsapp_active === 'true' || whatsapp_active === true,
            whatsapp_number,
            presupuesto: finalPresupuesto,
            presupuesto_restante: finalPresupuesto,
            estado: isAdmin ? 'activa' : 'pendiente_pago',
            target_id_ciudad: target_id_ciudad || null,
            target_genero: target_genero || 'todos',
            target_edad_min: target_edad_min ? parseInt(target_edad_min) : null,
            target_edad_max: target_edad_max ? parseInt(target_edad_max) : null
        });

        res.status(201).json({ success: true, message: "Publicación creada con éxito", data: nuevaPub });
    } catch (error) {
        console.error("Error al crear publicación:", error);
        res.status(500).json({ success: false, message: "Error al crear publicación" });
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

        const whereCondition = { 
            estado: 'activa',
            presupuesto_restante: { [Op.gt]: 0 }
        };

        if (uid) {
            whereCondition.id_usuario = { [Op.ne]: uid };

            // Obtener perfil del usuario para segmentación
            const userProfile = await Usuario.findByPk(uid);
            if (userProfile) {
                const userCityId = userProfile.id_ciudad;
                const userGender = userProfile.genero;
                const userAge = obtenerEdadDesdeIdentidad(userProfile.identidad);

                // Aplicar filtros de segmentación
                whereCondition[Op.and] = [
                    // Filtro de Ciudad
                    {
                        [Op.or]: [
                            { target_id_ciudad: null },
                            { target_id_ciudad: userCityId }
                        ]
                    },
                    // Filtro de Género
                    {
                        [Op.or]: [
                            { target_genero: 'todos' },
                            { target_genero: userGender }
                        ]
                    },
                    // Filtro de Edad
                    {
                        [Op.or]: [
                            {
                                [Op.and]: [
                                    { target_edad_min: null },
                                    { target_edad_max: null }
                                ]
                            },
                            userAge ? {
                                [Op.and]: [
                                    { target_edad_min: { [Op.lte]: userAge } },
                                    { target_edad_max: { [Op.gte]: userAge } }
                                ]
                            } : { id_publicacion: -1 } // Si no tiene edad y la pub tiene rango, no mostrar
                        ]
                    }
                ];
            }
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
            pub.total_interacciones = pub.interacciones ? pub.interacciones.length : 0;
            delete pub.interacciones;
            return pub;
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error al obtener mis publicaciones:", error);
        res.status(500).json({ success: false, message: "Error al obtener publicaciones" });
    }
};

// Admin: obtener publicaciones (todas o filtradas por estado) con paginación
const obtenerPublicacionesPendientes = async (req, res) => {
    try {
        const { estado, limit = 10, offset = 0 } = req.query;
        const whereCondition = estado ? { estado } : {};

        const { count, rows: publicaciones } = await Publicacion.findAndCountAll({
            where: whereCondition,
            include: [{
                model: Usuario,
                as: 'usuario',
                attributes: ['id_usuario', 'nombre', 'imagen_url', 'telefono']
            }],
            order: [['fecha', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Obtener estadísticas de interacciones para cada publicación
        const publicacionesConStats = await Promise.all(publicaciones.map(async (pub) => {
            const pubData = pub.toJSON();

            // Contar total de interacciones (incluyendo likes, views, polls, etc.)
            const totalInteracciones = await Interaccion.count({
                where: { id_publicacion: pub.id_publicacion }
            });

            // Usamos los contadores que ya vienen en la tabla Publicacion (vistas, likes)
            // y agregamos el total de interacciones calculado
            return {
                ...pubData,
                total_interacciones: totalInteracciones
            };
        }));

        res.json({ 
            success: true, 
            data: publicacionesConStats,
            total: count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error("Error al obtener publicaciones:", error);
        res.status(500).json({ success: false, message: "Error al obtener publicaciones" });
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

        // Eliminar medios (fotos/videos) de Cloudinary
        if (publicacion.media && publicacion.media.length > 0) {
            for (const item of publicacion.media) {
                if (item.public_id) {
                    const resourceType = item.type === 'video' ? 'video' : 'image';
                    await cloudinary.uploader.destroy(item.public_id, { resource_type: resourceType });
                }
            }
        }

        // Eliminar comprobante de pago de Cloudinary si existe
        if (publicacion.comprobante_public_id) {
            await cloudinary.uploader.destroy(publicacion.comprobante_public_id, { resource_type: 'image' });
        }

        // Eliminar el registro de la base de datos (hard delete)
        // Nota: Las interacciones se eliminan por CASCADE en la base de datos
        await publicacion.destroy();

        res.json({ success: true, message: "Publicación y todos sus registros asociados han sido eliminados correctamente" });

    } catch (error) {
        console.error("Error al eliminar publicación:", error);
        res.status(500).json({ success: false, message: "Error al eliminar la publicación y sus archivos" });
    }
};

const incrementarVista = async (req, res) => {
    try {
        const { id_publicacion } = req.params;
        const { id_usuario } = req.body;

        if (!id_usuario) {
            return res.status(400).json({ success: false, message: "id_usuario es requerido" });
        }

        // Verificar si este usuario ya registró una vista para esta publicación
        const vistaExistente = await Interaccion.findOne({
            where: { id_publicacion, id_usuario, tipo: 'vista' }
        });

        if (vistaExistente) {
            return res.json({ success: false, message: "Ya contabilizada", already_done: true });
        }

        // Registrar la interacción de vista
        await Interaccion.create({
            id_publicacion,
            id_usuario,
            tipo: 'vista',
            monto_ganado: 0
        });

        // Incrementar el contador en la publicación
        const pub = await Publicacion.findByPk(id_publicacion);
        if (!pub) {
            return res.status(404).json({ success: false, message: "Publicación no encontrada" });
        }
        await pub.increment('vistas');

        res.json({ success: true, message: "Vista registrada", vistas: pub.vistas + 1 });
    } catch (error) {
        console.error("Error al incrementar vista:", error);
        res.status(500).json({ success: false, message: "Error al incrementar vista" });
    }
};

const obtenerEstadisticasSegmentadas = async (req, res) => {
    try {
        const { id_publicacion } = req.params;

        // 1. Obtener todas las interacciones con datos demográficos del usuario
        const interacciones = await Interaccion.findAll({
            where: { id_publicacion },
            include: [{
                model: Usuario,
                as: 'usuario',
                attributes: ['id_usuario', 'id_ciudad', 'genero', 'identidad'],
                include: [{ model: Ciudad, as: 'ciudad', attributes: ['nombre_ciudad'] }]
            }]
        });

        const stats = {
            vistas: 0,
            interacciones: 0,
            desglose: {
                like: 0,
                poll: 0,
                share: 0,
                video_view: 0,
                click: 0,
                visita_web: 0,
                visita_whatsapp: 0,
                vista: 0
            },
            porCiudad: {},
            porEdad: {
                '13-17': 0,
                '18-24': 0,
                '25-34': 0,
                '35-44': 0,
                '45-54': 0,
                '55+': 0,
                'Desconocido': 0
            },
            porGenero: {
                'masculino': 0,
                'femenino': 0,
                'otro': 0,
                'prefiero_no_decirlo': 0,
                'desconocido': 0
            }
        };

        interacciones.forEach(inter => {
            // Contar totales siempre, incluso sin usuario (aunque id_usuario es obligatorio)
            if (inter.tipo === 'vista') {
                stats.vistas++;
            } else {
                stats.interacciones++;
            }

            // Incrementar desglose por tipo
            if (stats.desglose[inter.tipo] !== undefined) {
                stats.desglose[inter.tipo]++;
            }

            const user = inter.usuario;
            if (!user) return;

            // Segmentación por Ciudad (usamos todas las interacciones para segmentación global)
            const ciudadNombre = user.ciudad?.nombre_ciudad || 'Desconocida';
            stats.porCiudad[ciudadNombre] = (stats.porCiudad[ciudadNombre] || 0) + 1;

            // Segmentación por Género (todas las interacciones)
            const genero = user.genero || 'desconocido';
            stats.porGenero[genero]++;

            // Segmentación por Edad
            const age = obtenerEdadDesdeIdentidad(user.identidad);
            if (age !== null) {
                if (age < 18) stats.porEdad['13-17']++;
                else if (age <= 24) stats.porEdad['18-24']++;
                else if (age <= 34) stats.porEdad['25-34']++;
                else if (age <= 44) stats.porEdad['35-44']++;
                else if (age <= 54) stats.porEdad['45-54']++;
                else stats.porEdad['55+']++;
            } else {
                stats.porEdad['Desconocido']++;
            }
        });

        // Formatear para el frontend
        const result = {
            totalVistas: stats.vistas,
            totalInteracciones: stats.interacciones,
            desgloseInteracciones: stats.desglose,
            vistasPorCiudad: Object.entries(stats.porCiudad).map(([nombre, total]) => ({ nombre, total })),
            vistasPorEdad: Object.entries(stats.porEdad).map(([rango, total]) => ({ rango, total })),
            interaccionesPorGenero: Object.entries(stats.porGenero).map(([genero, total]) => ({ genero, total }))
        };

        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error al obtener estadísticas segmentadas:", error);
        res.status(500).json({ success: false, message: "Error al obtener estadísticas" });
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
    eliminarPublicacion,
    incrementarVista,
    obtenerEstadisticasSegmentadas
};

