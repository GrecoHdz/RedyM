const Retiro = require("../models/retiroModel");
const Usuario = require("../models/usuariosModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");
const { sequelize } = require("../config/database");

const crearRetiro = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id_usuario, monto, detalles_cuenta } = req.body;

        if (!monto || monto <= 0) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "El monto debe ser mayor a 0" });
        }

        // Validar que el usuario tenga suficiente saldo
        const credito = await CreditoUsuario.findOne({ where: { id_usuario }, transaction: t });
        if (!credito || Number(credito.monto_credito) < Number(monto)) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Saldo insuficiente" });
        }

        // Crear el registro de retiro
        const retiro = await Retiro.create({
            id_usuario,
            monto,
            detalles_cuenta,
            estado: 'pendiente'
        }, { transaction: t });

        // Restar el saldo del usuario (congelar saldo)
        await CreditoUsuario.decrement('monto_credito', {
            by: monto,
            where: { id_usuario },
            transaction: t
        });

        await t.commit();
        res.json({ success: true, data: retiro, message: "Solicitud de retiro enviada con éxito" });
    } catch (error) {
        if (t) await t.rollback();
        console.error("Error al crear retiro:", error);
        res.status(500).json({ success: false, message: "Error al procesar la solicitud de retiro" });
    }
};

const obtenerRetirosUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const retiros = await Retiro.findAll({
            where: { id_usuario },
            order: [['fecha', 'DESC']]
        });
        res.json({ success: true, data: retiros });
    } catch (error) {
        console.error("Error al obtener retiros:", error);
        res.status(500).json({ success: false, message: "Error al obtener retiros" });
    }
};

const obtenerTodosLosRetiros = async (req, res) => {
    try {
        const retiros = await Retiro.findAll({
            include: [{ model: Usuario, as: 'usuario', attributes: ['nombre', 'email', 'telefono'] }],
            order: [['fecha', 'DESC']]
        });
        res.json({ success: true, data: retiros });
    } catch (error) {
        console.error("Error al obtener todos los retiros:", error);
        res.status(500).json({ success: false, message: "Error al obtener todos los retiros" });
    }
};

const actualizarEstadoRetiro = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { estado } = req.body; // 'aprobado' o 'rechazado'

        const retiro = await Retiro.findByPk(id, { transaction: t });
        if (!retiro) {
            await t.rollback();
            return res.status(404).json({ success: false, message: "Retiro no encontrado" });
        }

        if (retiro.estado !== 'pendiente') {
            await t.rollback();
            return res.status(400).json({ success: false, message: "Este retiro ya ha sido procesado" });
        }

        if (estado === 'rechazado') {
            // Devolver el saldo al usuario
            await CreditoUsuario.increment('monto_credito', {
                by: retiro.monto,
                where: { id_usuario: retiro.id_usuario },
                transaction: t
            });
        }

        retiro.estado = estado;
        await retiro.save({ transaction: t });

        await t.commit();
        res.json({ success: true, message: `Retiro ${estado} correctamente` });
    } catch (error) {
        if (t) await t.rollback();
        console.error("Error al actualizar estado de retiro:", error);
        res.status(500).json({ success: false, message: "Error al actualizar estado de retiro" });
    }
};

module.exports = {
    crearRetiro,
    obtenerRetirosUsuario,
    obtenerTodosLosRetiros,
    actualizarEstadoRetiro
};
