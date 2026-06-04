const { sequelize } = require("../config/database");
const SolicitudUpgrade = require("../models/solicitudesUpgradeModel");
const Usuario = require("../models/usuariosModel");
const Cuenta = require("../models/cuentasModel");
const RedNiveles = require("../models/redNivelesModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");
const { procesarAutoUpgradeInterno } = require("./redNivelesController");

// Helper to get root user ID (same as in redNivelesController)
const getRootUserId = async () => {
    const Config = require("../models/configModel");
    const rootConfig = await Config.findOne({ where: { tipo_config: 'id_usuario_raiz' } });
    return rootConfig ? parseInt(rootConfig.valor, 10) : 1;
};

// Crear solicitud de upgrade por transferencia
const crearSolicitud = async (req, res) => {
    try {
        const { id_usuario, id_cuenta, num_comprobante, monto, nivel_destino } = req.body;

        if (!id_usuario || !nivel_destino || !monto) {
            return res.status(400).json({ success: false, message: "Faltan datos requeridos" });
        }

        // Verificar si ya tiene una solicitud pendiente para el mismo nivel o en general
        const existente = await SolicitudUpgrade.findOne({
            where: {
                id_usuario,
                estado: 'pendiente'
            }
        });

        if (existente) {
            return res.status(400).json({
                success: false,
                message: "Ya tienes una solicitud de upgrade pendiente de aprobación por el administrador."
            });
        }

        const solicitud = await SolicitudUpgrade.create({
            id_usuario,
            id_cuenta,
            num_comprobante,
            monto,
            nivel_destino,
            fecha: new Date(),
            estado: 'pendiente'
        });

        res.status(201).json({
            success: true,
            message: "Solicitud de upgrade enviada correctamente",
            data: solicitud
        });
    } catch (error) {
        console.error("Error al crear solicitud de upgrade:", error);
        res.status(500).json({ success: false, message: "Error al crear la solicitud", error: error.message });
    }
};

// Listar solicitudes (para Admin)
const listarSolicitudes = async (req, res) => {
    try {
        const { estado } = req.query;
        const whereClause = {};
        if (estado) {
            whereClause.estado = estado;
        }

        const solicitudes = await SolicitudUpgrade.findAll({
            where: whereClause,
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id_usuario', 'nombre', 'email', 'telefono', 'imagen_url']
                },
                {
                    model: Cuenta,
                    as: 'cuenta',
                    attributes: ['id_cuenta', 'banco', 'num_cuenta', 'tipo', 'beneficiario']
                }
            ],
            order: [['fecha', 'DESC']]
        });

        res.json({ success: true, data: solicitudes });
    } catch (error) {
        console.error("Error al listar solicitudes de upgrade:", error);
        res.status(500).json({ success: false, message: "Error al listar las solicitudes", error: error.message });
    }
};

// Procesar solicitud (Aprobar/Rechazar por Admin)
const procesarSolicitud = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // 'aprobada' o 'rechazada'

    if (!['aprobada', 'rechazada'].includes(estado)) {
        return res.status(400).json({ success: false, message: "Estado no válido. Use 'aprobada' o 'rechazada'" });
    }

    const t = await sequelize.transaction();
    try {
        const solicitud = await SolicitudUpgrade.findByPk(id, { transaction: t });

        if (!solicitud) {
            await t.rollback();
            return res.status(404).json({ success: false, message: "Solicitud no encontrada" });
        }

        if (solicitud.estado !== 'pendiente') {
            await t.rollback();
            return res.status(400).json({ success: false, message: "La solicitud ya ha sido procesada" });
        }

        if (estado === 'rechazada') {
            await solicitud.update({ estado: 'rechazada' }, { transaction: t });
            await t.commit();
            return res.json({ success: true, message: "Solicitud rechazada correctamente" });
        }

        // --- APROBACIÓN ---
        const id_usuario = solicitud.id_usuario;
        const siguienteNivel = solicitud.nivel_destino;
        const costo = parseFloat(solicitud.monto);

        // Obtener nodo en la red
        const nodo = await RedNiveles.findOne({ where: { id_usuario }, transaction: t });
        if (!nodo) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "El usuario no está registrado en la red" });
        }

        // Buscar beneficiario (Compresión Dinámica)
        let id_beneficiario = null;
        let actual = nodo.id_padre;
        const rootId = await getRootUserId();

        for (let i = 1; i < siguienteNivel; i++) {
            if (actual) {
                const p = await RedNiveles.findOne({ where: { id_usuario: actual }, transaction: t });
                actual = p ? p.id_padre : rootId;
            } else {
                actual = rootId;
            }
        }

        let calificado = false;
        let bActual = actual;

        while (!calificado && bActual && bActual !== rootId) {
            const bNode = await RedNiveles.findOne({ where: { id_usuario: bActual }, transaction: t });
            if (bNode && bNode.nivel_actual >= siguienteNivel) {
                calificado = true;
                id_beneficiario = bActual;
            } else {
                bActual = bNode ? bNode.id_padre : rootId;
            }
        }

        if (!calificado) id_beneficiario = rootId;

        // Pagar comisión al beneficiario
        const saldoBeneficiario = await CreditoUsuario.findOne({ where: { id_usuario: id_beneficiario }, transaction: t });
        let montoFinalBen = parseFloat(saldoBeneficiario ? saldoBeneficiario.monto_credito : 0) + costo;
        montoFinalBen = parseFloat(montoFinalBen.toFixed(2));

        await CreditoUsuario.upsert({
            id_usuario: id_beneficiario,
            monto_credito: montoFinalBen,
            fecha: new Date()
        }, { transaction: t });

        console.log(`[SolicitudUpgrade] 💸 Comisión de Nivel ${siguienteNivel} pagada a ${id_beneficiario}: $${costo}`);

        // Actualizar nivel del usuario
        await nodo.update({ nivel_actual: siguienteNivel }, { transaction: t });

        // Actualizar solicitud
        await solicitud.update({ estado: 'aprobada' }, { transaction: t });

        await t.commit();

        // Disparar upgrades automáticos posteriores en cadena
        try {
            console.log(`[SolicitudUpgrade] 🚀 Evaluando auto-upgrades después de subir a ${id_usuario}`);
            await procesarAutoUpgradeInterno(id_usuario);
            if (nodo.id_padre) {
                await procesarAutoUpgradeInterno(nodo.id_padre);
            }
            if (nodo.id_patrocinador) {
                await procesarAutoUpgradeInterno(nodo.id_patrocinador);
            }
        } catch (autoErr) {
            console.error("[SolicitudUpgrade] Error en disparador de auto-upgrades:", autoErr.message);
        }

        res.json({ success: true, message: "Solicitud aprobada e incrementado nivel correctamente", nivel_nuevo: siguienteNivel });

    } catch (error) {
        if (t && !t.finished) await t.rollback();
        console.error("Error al aprobar solicitud de upgrade:", error);
        res.status(500).json({ success: false, message: "Error al procesar la solicitud", error: error.message });
    }
};

module.exports = {
    crearSolicitud,
    listarSolicitudes,
    procesarSolicitud
};
