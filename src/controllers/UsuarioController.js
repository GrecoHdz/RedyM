const { sequelize } = require("../config/database");
const Usuario = require("../models/usuariosModel");
const Ciudad = require("../models/ciudadesModel");
const Rol = require("../models/rolesModel");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const saltRounds = 10;

// OBTENER TODOS LOS USUARIOS (READ ALL)
const obtenerUsuarios = async (req, res) => {
    try {
        const { estado, rol, id_ciudad } = req.query;
        const whereCondition = {};

        if (estado) whereCondition.estado = estado;
        if (id_ciudad) whereCondition.id_ciudad = id_ciudad;
        if (rol) whereCondition['$rol.id_rol$'] = rol;

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

// OBTENER UN USUARIO POR ID (READ ONE)
const obtenerUsuarioPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await Usuario.findByPk(id, {
            attributes: { exclude: ['password_hash', 'reset_password_token', 'reset_password_expires'] },
            include: [
                { model: Rol, as: 'rol', attributes: ['nombre_rol'] },
                { model: Ciudad, as: 'ciudad', attributes: ['nombre_ciudad'] }
            ]
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        res.status(200).json({ success: true, data: usuario });
    } catch (error) {
        console.error("Error al obtener usuario:", error);
        res.status(500).json({ success: false, message: "Error al obtener usuario", error: error.message });
    }
};

// CREAR USUARIO (CREATE)
const crearUsuario = async (req, res) => {
    const { nombre, identidad, email, telefono, password, id_ciudad, es_tecnico } = req.body;

    try {
        // Verificar si ya existe
        const existe = await Usuario.findOne({
            where: {
                [Op.or]: [{ email }, { identidad }, { telefono }]
            }
        });

        if (existe) {
            return res.status(400).json({
                success: false,
                message: "Email, Identidad o Teléfono ya están registrados"
            });
        }

        // Obtener Rol
        const nombreRol = es_tecnico ? 'tecnico' : 'usuario';
        const rol = await Rol.findOne({ where: { nombre_rol: nombreRol } });

        if (!rol) {
            return res.status(500).json({ success: false, message: `Rol '${nombreRol}' no encontrado en la base de datos` });
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
        });

        const data = nuevoUsuario.get({ plain: true });
        delete data.password_hash;

        res.status(201).json({
            success: true,
            message: "Usuario creado correctamente",
            data: data
        });
    } catch (error) {
        console.error("Error al crear usuario:", error);
        res.status(500).json({ success: false, message: "Error al crear usuario", error: error.message });
    }
};

// ACTUALIZAR USUARIO (UPDATE)
const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, telefono, id_ciudad, estado, id_rol, password } = req.body;

        const usuario = await Usuario.findByPk(id);
        if (!usuario) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        const updates = {};
        if (nombre) updates.nombre = nombre;
        if (email) updates.email = email;
        if (telefono) updates.telefono = telefono;
        if (id_ciudad) updates.id_ciudad = id_ciudad;
        if (estado) updates.estado = estado;
        if (id_rol) updates.id_rol = id_rol;

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

module.exports = {
    obtenerUsuarios,
    obtenerUsuarioPorId,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario
};