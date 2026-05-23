const { sequelize } = require("../config/database");
const Usuario = require("../models/usuariosModel");
const Ciudad = require("../models/ciudadesModel");
const Rol = require("../models/rolesModel");
const Config = require("../models/configModel");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const { cloudinary } = require("../config/cloudinary");
const saltRounds = 10;

const CreditoUsuario = require("../models/creditoUsuariosModel");
const RedNiveles = require("../models/redNivelesModel");
const Membresia = require("../models/membresiaModel");
const Publicacion = require("../models/publicacionesModel");
const Interaccion = require("../models/InteraccionModel");
const Retiro = require("../models/retiroModel");

// OBTENER TODOS LOS USUARIOS (READ ALL)
const obtenerUsuarios = async (req, res) => {
    try {
        const { estado, rol, id_ciudad, verificado, tieneIdentidad } = req.query;
        const whereCondition = {};

        if (estado) whereCondition.estado = estado;
        if (id_ciudad) whereCondition.id_ciudad = id_ciudad;
        if (rol) whereCondition['$rol.id_rol$'] = rol;
        if (verificado !== undefined) whereCondition.verificado = verificado === 'true';
        if (tieneIdentidad === 'true') {
            whereCondition.identidad_url = { [Op.ne]: null };
        }

        const usuarios = await Usuario.findAll({
            where: whereCondition,
            attributes: { exclude: ['password_hash', 'reset_password_token', 'reset_password_expires'] },
            include: [
                { model: Rol, as: 'rol', attributes: ['nombre_rol'] },
                { model: Ciudad, as: 'ciudad', attributes: ['nombre_ciudad'] }
            ],
            order: [['id_usuario', 'DESC']]
        });

        res.status(200).json({
            success: true,
            count: usuarios.length,
            data: usuarios
        });
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ success: false, message: "Error al obtener usuarios", error: error.message });
    }
};

// OBTENER UN USUARIO POR ID (READ ONE - ACTUALIZADO PARA ADMIN)
const obtenerUsuarioPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await Usuario.findByPk(id, {
            attributes: { exclude: ['password_hash', 'reset_password_token', 'reset_password_expires'] },
            include: [
                { model: Rol, as: 'rol', attributes: ['nombre_rol'] },
                { model: Ciudad, as: 'ciudad', attributes: ['nombre_ciudad'] },
                { model: CreditoUsuario, as: 'credito' },
                { 
                    model: RedNiveles, 
                    as: 'nodoRed',
                    include: [
                        { model: Usuario, as: 'padre', attributes: ['nombre'] },
                        { model: Usuario, as: 'patrocinador', attributes: ['nombre'] }
                    ]
                },
                { 
                    model: Membresia, 
                    as: 'membresias',
                    separate: true,
                    limit: 10,
                    order: [['fecha', 'DESC']]
                },
                {
                    model: Publicacion,
                    as: 'publicaciones',
                    separate: true,
                    limit: 5,
                    order: [['fecha', 'DESC']]
                }
            ]
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        // Obtener conteos adicionales que no queremos traer como arrays completos
        const totalInteracciones = await Interaccion.count({ where: { id_usuario: id } });
        const totalPublicaciones = await Publicacion.count({ where: { id_usuario: id } });
        const membresiasPagadas = await Membresia.count({ where: { id_usuario: id, estado: 'completado' } });

        // Obtener progreso de matriz (conteos por nivel)
        let matrixConteos = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let idsPadres = [parseInt(id)];
        for (let nivel = 1; nivel <= 5; nivel++) {
            const hijos = await RedNiveles.findAll({
                where: { 
                    id_padre: { [Op.in]: idsPadres },
                    nivel_actual: { [Op.gt]: 0 }
                },
                attributes: ['id_usuario']
            });
            if (hijos.length === 0) break;
            matrixConteos[nivel] = hijos.length;
            idsPadres = hijos.map(h => h.id_usuario);
        }

        // Resumen de interacciones por tipo
        const interaccionStats = await Interaccion.findAll({
            where: { id_usuario: id },
            attributes: [
                'tipo',
                [sequelize.fn('COUNT', sequelize.col('id_interaccion')), 'total']
            ],
            group: ['tipo']
        });

        const data = usuario.toJSON();
        // Obtener historial de interacciones recientes (últimas 20)
        const historialInteracciones = await Interaccion.findAll({
            where: { id_usuario: id },
            limit: 20,
            order: [['fecha', 'DESC']],
            include: [
                {
                    model: Publicacion,
                    as: 'publicacion',
                    attributes: ['id_publicacion', 'content', 'media'],
                    include: [
                        { model: Usuario, as: 'usuario', attributes: ['nombre'] }
                    ]
                }
            ]
        });

        data.stats = {
            totalInteracciones,
            totalPublicaciones,
            membresiasPagadas,
            matrixConteos,
            historialInteracciones,
            interaccionStats: interaccionStats.reduce((acc, curr) => {
                acc[curr.tipo] = curr.get('total');
                return acc;
            }, {})
        };

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error al obtener usuario:", error);
        res.status(500).json({ success: false, message: "Error al obtener usuario", error: error.message });
    }
};

// CREAR USUARIO (CREATE)
const crearUsuario = async (req, res) => {
    const { nombre, identidad, email, telefono, password, id_ciudad, es_tecnico, id_patrocinador } = req.body;
    const t = await sequelize.transaction();

    try {
        // Verificar si ya existe
        const existe = await Usuario.findOne({
            where: {
                [Op.or]: [{ email }, { identidad }, { telefono }]
            },
            transaction: t
        });

        if (existe) {
            await t.rollback();
            return res.status(400).json({
                success: false,
                message: "Email, Identidad o Teléfono ya están registrados"
            });
        }

        // Obtener Rol
        const nombreRol = es_tecnico ? 'tecnico' : 'usuario';
        const rol = await Rol.findOne({ where: { nombre_rol: nombreRol }, transaction: t });

        if (!rol) {
            await t.rollback();
            return res.status(500).json({ success: false, message: `Rol '${nombreRol}' no encontrado` });
        }

        // Hashear Password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Crear Usuario
        const nuevoUsuario = await Usuario.create({
            nombre,
            identidad,
            email,
            telefono,
            id_ciudad,
            id_rol: rol.id_rol,
            password_hash: hashedPassword,
            estado: es_tecnico ? 'deshabilitado' : 'activo'
        }, { transaction: t });

        // Crear registro de crédito inicial
        const CreditoUsuario = require("../models/creditoUsuariosModel");
        await CreditoUsuario.create({
            id_usuario: nuevoUsuario.id_usuario,
            monto_credito: 0.00
        }, { transaction: t });

        // Si hay patrocinador, registrar en la red (Nivel 0 - Pendiente de Pago)
        if (!es_tecnico) {
            let patrocinadorFinal = id_patrocinador;

            // Si no viene id_patrocinador, buscar el predeterminado en la tabla config
            if (!patrocinadorFinal) {
                const configReferido = await Config.findOne({
                    where: { tipo_config: 'referido_predeterminado' },
                    transaction: t
                });
                if (configReferido) {
                    patrocinadorFinal = parseInt(configReferido.valor);
                } else {
                    // Fallback a 1 si no está configurado (aunque el usuario dice que ahí estará)
                    patrocinadorFinal = 1;
                }
            }

            const RedNiveles = require("../models/redNivelesModel");
            await RedNiveles.create({
                id_usuario: nuevoUsuario.id_usuario,
                id_patrocinador: patrocinadorFinal,
                nivel_actual: 0
            }, { transaction: t });
        }

        await t.commit();

        const data = nuevoUsuario.get({ plain: true });
        delete data.password_hash;

        res.status(201).json({
            success: true,
            message: "Usuario creado correctamente",
            data: data
        });
    } catch (error) {
        if (t) await t.rollback();
        console.error("Error al crear usuario:", error);
        res.status(500).json({ success: false, message: "Error al crear usuario", error: error.message });
    }
};

// ACTUALIZAR USUARIO (UPDATE)
const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, telefono, identidad, id_ciudad, estado, id_rol, password, verificado } = req.body;

        const usuario = await Usuario.findByPk(id);
        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        const updates = {};
        if (nombre) updates.nombre = nombre;
        if (id_ciudad) updates.id_ciudad = id_ciudad;
        if (estado) updates.estado = estado;
        if (id_rol) updates.id_rol = id_rol;
        if (verificado !== undefined) updates.verificado = verificado;

        // Verificar si los datos únicos ya están en uso por OTRO usuario
        const uniqueChecks = [];
        if (email) uniqueChecks.push({ email });
        if (identidad) uniqueChecks.push({ identidad });
        if (telefono) uniqueChecks.push({ telefono });

        if (uniqueChecks.length > 0) {
            const existe = await Usuario.findOne({
                where: {
                    [Op.or]: uniqueChecks,
                    id_usuario: { [Op.ne]: id }
                }
            });

            if (existe) {
                let duplicado = "";
                if (email === existe.email) duplicado = "Email";
                else if (identidad === existe.identidad) duplicado = "Identidad";
                else if (telefono === existe.telefono) duplicado = "Teléfono";

                return res.status(400).json({ success: false, message: `${duplicado} ya está registrado en otra cuenta` });
            }
        }

        if (email) updates.email = email;
        if (identidad) updates.identidad = identidad;
        if (telefono) updates.telefono = telefono;

        if (password) {
            updates.password_hash = await bcrypt.hash(password, saltRounds);
        }

        await usuario.update(updates);

        res.status(200).json({
            success: true,
            message: "Usuario actualizado correctamente",
            data: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, email: usuario.email }
        });
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ success: false, message: "Error al actualizar usuario", error: error.message });
    }
};

// ELIMINAR USUARIO (DELETE)
const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await Usuario.findByPk(id);

        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        await usuario.destroy();

        res.status(200).json({
            success: true,
            message: "Usuario eliminado correctamente"
        });
    } catch (error) {
        console.error("Error al eliminar usuario:", error);
        res.status(500).json({ success: false, message: "Error al eliminar usuario", error: error.message });
    }
};

// ACTUALIZAR FOTO DE PERFIL
const actualizarFotoPerfil = async (req, res) => {
    try {
        const { id } = req.params;

        // Seguridad: Solo el propio usuario o un administrador puede cambiar la foto
        if (req.user.id_usuario != id && req.user.rol !== 'admin' && req.user.rol !== 'sa') {
            if (req.file && req.file.filename) {
                await cloudinary.uploader.destroy(req.file.filename);
            }
            return res.status(403).json({ success: false, message: "No tienes permiso para actualizar esta foto de perfil" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No se ha subido ninguna imagen" });
        }

        const usuario = await Usuario.findByPk(id);
        if (!usuario) {
            // Si el usuario no existe, pero la imagen se subió a Cloudinary, deberíamos eliminarla
            if (req.file.filename) {
                await cloudinary.uploader.destroy(req.file.filename);
            }
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        // Eliminar la imagen anterior de Cloudinary si existe
        if (usuario.imagen_public_id) {
            try {
                await cloudinary.uploader.destroy(usuario.imagen_public_id);
            } catch (error) {
                console.error("Error al eliminar imagen anterior de Cloudinary:", error);
            }
        }

        // Actualizar el usuario con la nueva información de la imagen
        await usuario.update({
            imagen_url: req.file.path,
            imagen_public_id: req.file.filename
        });

        res.status(200).json({
            success: true,
            message: "Foto de perfil actualizada correctamente",
            data: {
                imagen_url: usuario.imagen_url,
                imagen_public_id: usuario.imagen_public_id
            }
        });
    } catch (error) {
        console.error("Error al actualizar foto de perfil:", error);
        res.status(500).json({ success: false, message: "Error al actualizar foto de perfil", error: error.message });
    }
};

// ELIMINAR FOTO DE PERFIL
const eliminarFotoPerfil = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await Usuario.findByPk(id);
        if (!usuario) return res.status(404).json({ success: false, message: "No encontrado" });

        if (usuario.imagen_public_id) {
            try { await cloudinary.uploader.destroy(usuario.imagen_public_id); } catch (e) { }
        }

        await usuario.update({
            imagen_url: null,
            imagen_public_id: null
        });

        res.status(200).json({ success: true, message: "Foto de perfil eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al eliminar foto", error: error.message });
    }
};

// ACTUALIZAR FOTO DE IDENTIDAD (VERIFICACIÓN)
const actualizarFotoIdentidad = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.id_usuario != id && req.user.rol !== 'admin' && req.user.rol !== 'sa') {
            if (req.file && req.file.filename) {
                await cloudinary.uploader.destroy(req.file.filename);
            }
            return res.status(403).json({ success: false, message: "No tienes permiso" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No hay archivo" });
        }

        const usuario = await Usuario.findByPk(id);
        if (!usuario) {
            if (req.file.filename) await cloudinary.uploader.destroy(req.file.filename);
            return res.status(404).json({ success: false, message: "No encontrado" });
        }

        if (usuario.identidad_public_id) {
            try { await cloudinary.uploader.destroy(usuario.identidad_public_id); } catch (e) { }
        }

        await usuario.update({
            identidad_url: req.file.path,
            identidad_public_id: req.file.filename,
            verificado: false
        });

        res.status(200).json({
            success: true,
            message: "Identidad actualizada",
            data: {
                identidad_url: usuario.identidad_url,
                identidad_public_id: usuario.identidad_public_id,
                verificado: usuario.verificado
            }
        });
    } catch (error) {
        console.error("Error identity upload:", error);
        res.status(500).json({ success: false, message: "Error", error: error.message });
    }
};

// ELIMINAR FOTO DE IDENTIDAD
const eliminarFotoIdentidad = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await Usuario.findByPk(id);
        if (!usuario) return res.status(404).json({ success: false, message: "No encontrado" });

        if (usuario.identidad_public_id) {
            try { await cloudinary.uploader.destroy(usuario.identidad_public_id); } catch (e) { }
        }

        await usuario.update({
            identidad_url: null,
            identidad_public_id: null,
            verificado: false
        });

        res.status(200).json({ success: true, message: "Identidad eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error", error: error.message });
    }
};

// CAMBIO DE CLAVE (SEGURIDAD)
const cambioClave = async (req, res) => {
    try {
        const { id } = req.params;
        const { currentPassword, newPassword } = req.body;
        console.log(`[BACKEND] Intento de cambio de clave para usuario: ${id}`);
        console.log(`[BACKEND] Payload recibido:`, req.body);

        const usuario = await Usuario.findByPk(id);
        if (!usuario) {
            console.warn(`[BACKEND] Usuario ${id} no encontrado`);
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        const isMatch = await bcrypt.compare(currentPassword, usuario.password_hash);
        if (!isMatch) {
            console.warn(`[BACKEND] Contraseña actual incorrecta para usuario ${id}`);
            return res.status(400).json({ success: false, message: "Contraseña actual incorrecta" });
        }

        usuario.password_hash = await bcrypt.hash(newPassword, saltRounds);
        await usuario.save();

        console.log(`[BACKEND] Contraseña actualizada correctamente para usuario ${id}`);
        res.status(200).json({ success: true, message: "Contraseña actualizada" });
    } catch (error) {
        console.error("[BACKEND] Error al cambiar clave:", error);
        res.status(500).json({ success: false, message: "Error al cambiar clave", error: error.message });
    }
};

// BUSCAR USUARIO POR IDENTIDAD (PARA REGALOS)
const obtenerUsuarioByIdentidad = async (req, res) => {
    try {
        const { identidad } = req.params;
        const Membresia = require("../models/membresiaModel");

        const usuario = await Usuario.findOne({
            where: { 
                identidad,
                estado: 'activo' // Solo buscar usuarios activos
            },
            attributes: ['id_usuario', 'nombre', 'identidad', 'imagen_url', 'estado'],
            include: [{
                model: Membresia,
                as: 'membresias', // Asegúrate de que el alias coincida con el definido en models/index.js
                limit: 1,
                order: [['fecha', 'DESC']],
                attributes: ['estado']
            }]
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado o no está habilitado" });
        }

        // Aplanar el estado de la membresía para facilidad del frontend
        const data = usuario.toJSON();
        data.estado_membresia = data.membresias?.[0]?.estado || 'ninguna';
        delete data.membresias;

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error al buscar por identidad:", error);
        res.status(500).json({ success: false, message: "Error en el servidor" });
    }
};

module.exports = {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    obtenerUsuarioByIdentidad,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    actualizarFotoPerfil,
    eliminarFotoPerfil,
    actualizarFotoIdentidad,
    eliminarFotoIdentidad,
    cambioClave
};