const MisionReclamo = require("../models/MisionReclamoModel");
const MisionEspecial = require("../models/MisionEspecialModel");
const Interaccion = require("../models/InteraccionModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");
const Config = require("../models/configModel");
const Usuario = require("../models/usuariosModel");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");

// Helper to get range of today in local UTC-6 timezone
const getTodayRange = () => {
    const todayStr = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startOfToday = new Date(`${todayStr}T00:00:00-06:00`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999-06:00`);
    
    return {
        [Op.between]: [startOfToday, endOfToday]
    };
};

/**
 * Obtener progreso de las misiones automáticas del día
 */
const getMisionesProgress = async (req, res) => {
    try {
        const id_usuario = req.params.id_usuario || req.user?.id_usuario;
        if (!id_usuario) {
            return res.status(400).json({ success: false, error: "Falta id_usuario" });
        }

        // 1. Contar interacciones únicas por tipo hoy
        const interaccionesHoy = await Interaccion.findAll({
            attributes: [
                'tipo',
                [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('id_publicacion'))), 'cantidad']
            ],
            where: {
                id_usuario,
                tipo: ['like', 'video_view', 'share'],
                fecha: getTodayRange()
            },
            group: ['tipo']
        });

        const progress = {
            likes: 0,
            video: 0,
            share: 0
        };

        interaccionesHoy.forEach(item => {
            const tipo = item.getDataValue('tipo');
            const cantidad = parseInt(item.getDataValue('cantidad'), 10) || 0;
            if (tipo === 'like') progress.likes = cantidad;
            if (tipo === 'video_view') progress.video = cantidad;
            if (tipo === 'share') progress.share = cantidad;
        });

        // 2. Verificar si ya reclamó hoy la misión automática
        const reclamoHoy = await MisionReclamo.findOne({
            where: {
                id_usuario,
                tipo: 'auto',
                fecha: getTodayRange()
            }
        });

        res.json({
            success: true,
            progress,
            rewardClaimed: !!reclamoHoy
        });

    } catch (error) {
        console.error("Error al obtener progreso de misiones:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Reclamar recompensa de misión automática
 */
const reclamarMisionAuto = async (req, res) => {
    try {
        const id_usuario = req.user?.id_usuario || req.body.id_usuario;
        if (!id_usuario) {
            return res.status(400).json({ success: false, error: "Falta id_usuario" });
        }

        // 1. Volver a verificar el progreso en el servidor
        const interaccionesHoy = await Interaccion.findAll({
            attributes: [
                'tipo',
                [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('id_publicacion'))), 'cantidad']
            ],
            where: {
                id_usuario,
                tipo: ['like', 'video_view', 'share'],
                fecha: getTodayRange()
            },
            group: ['tipo']
        });

        const progress = { likes: 0, video: 0, share: 0 };
        interaccionesHoy.forEach(item => {
            const tipo = item.getDataValue('tipo');
            const cantidad = parseInt(item.getDataValue('cantidad'), 10) || 0;
            if (tipo === 'like') progress.likes = cantidad;
            if (tipo === 'video_view') progress.video = cantidad;
            if (tipo === 'share') progress.share = cantidad;
        });

        // Las metas son: 3 likes, 1 video_view, 1 share
        if (progress.likes < 3 || progress.video < 1 || progress.share < 1) {
            return res.status(400).json({
                success: false,
                error: "Misiones no completadas aún",
                progress
            });
        }

        // 2. Verificar que no haya reclamado ya hoy
        const reclamoHoy = await MisionReclamo.findOne({
            where: {
                id_usuario,
                tipo: 'auto',
                fecha: getTodayRange()
            }
        });

        if (reclamoHoy) {
            return res.status(400).json({ success: false, error: "Ya reclamaste la recompensa de hoy" });
        }

        // 3. Obtener el valor configurado para la misión
        const configMision = await Config.findOne({ where: { tipo_config: 'valor_mision' } });
        const rewardValue = configMision ? parseFloat(configMision.valor) : 10.00;

        // 4. Acreditar saldo y registrar reclamo
        const creditoExistente = await CreditoUsuario.findOne({ where: { id_usuario } });
        let nuevoMonto = rewardValue;
        if (creditoExistente) {
            nuevoMonto += parseFloat(creditoExistente.monto_credito);
        }

        await CreditoUsuario.upsert({
            id_usuario,
            monto_credito: parseFloat(nuevoMonto.toFixed(2)),
            fecha: new Date()
        });

        const reclamo = await MisionReclamo.create({
            id_usuario,
            tipo: 'auto',
            estado: 'aprobado',
            monto: rewardValue,
            fecha: new Date()
        });

        res.json({
            success: true,
            message: "Recompensa diaria acreditada correctamente",
            monto_acreditado: rewardValue,
            nuevo_saldo: nuevoMonto,
            data: reclamo
        });

    } catch (error) {
        console.error("Error al reclamar misión automática:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener todas las misiones especiales activas
 */
const getMisionesEspeciales = async (req, res) => {
    try {
        const id_usuario = req.query.id_usuario || req.user?.id_usuario;

        const misiones = await MisionEspecial.findAll({
            where: { activa: true },
            order: [['fecha_creacion', 'DESC']]
        });

        // Si se provee usuario, buscar los reclamos de hoy para estas misiones
        const misionesConEstado = await Promise.all(misiones.map(async (mision) => {
            let claimStatus = null;
            if (id_usuario) {
                const reclamo = await MisionReclamo.findOne({
                    where: {
                        id_usuario,
                        id_mision: mision.id_mision,
                        tipo: 'especial',
                        fecha: getTodayRange()
                    },
                    order: [['fecha', 'DESC']]
                });
                if (reclamo) {
                    claimStatus = reclamo.estado;
                }
            }
            return {
                ...mision.toJSON(),
                claimStatus
            };
        }));

        res.json({
            success: true,
            data: misionesConEstado
        });

    } catch (error) {
        console.error("Error al obtener misiones especiales:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * CRUD Misiones Especiales (Admin)
 */
const listarMisionesAdmin = async (req, res) => {
    try {
        const misiones = await MisionEspecial.findAll({
            order: [['fecha_creacion', 'DESC']]
        });
        res.json({ success: true, data: misiones });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const crearMisionAdmin = async (req, res) => {
    try {
        const { titulo, descripcion, emoji, valor, tipo_respuesta, opciones, activa } = req.body;
        const mision = await MisionEspecial.create({
            titulo, descripcion, emoji, valor, tipo_respuesta, opciones, activa
        });
        res.json({ success: true, data: mision });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const actualizarMisionAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, descripcion, emoji, valor, tipo_respuesta, opciones, activa } = req.body;
        const mision = await MisionEspecial.findByPk(id);
        if (!mision) return res.status(404).json({ success: false, error: "Misión no encontrada" });

        await mision.update({
            titulo, descripcion, emoji, valor, tipo_respuesta, opciones, activa
        });
        res.json({ success: true, data: mision });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const eliminarMisionAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const mision = await MisionEspecial.findByPk(id);
        if (!mision) return res.status(404).json({ success: false, error: "Misión no encontrada" });
        await mision.destroy();
        res.json({ success: true, message: "Misión eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Enviar reclamo de misión especial
 */
const reclamarMisionEspecial = async (req, res) => {
    try {
        const id_usuario = req.user?.id_usuario || req.body.id_usuario;
        const { id_mision, respuesta } = req.body;

        if (!id_usuario || !id_mision) {
            return res.status(400).json({ success: false, error: "Faltan datos obligatorios" });
        }

        // 1. Verificar si la misión existe y está activa
        const mision = await MisionEspecial.findByPk(id_mision);
        if (!mision || !mision.activa) {
            return res.status(400).json({ success: false, error: "Misión no disponible" });
        }

        // 2. Verificar si ya existe reclamo de esta misión hoy
        const reclamoExistente = await MisionReclamo.findOne({
            where: {
                id_usuario,
                id_mision,
                tipo: 'especial',
                estado: ['pendiente', 'aprobado'],
                fecha: getTodayRange()
            }
        });

        if (reclamoExistente) {
            return res.status(400).json({
                success: false,
                error: "Ya tienes un reclamo registrado hoy para esta misión"
            });
        }

        // 3. Crear reclamo
        const reclamo = await MisionReclamo.create({
            id_usuario,
            id_mision,
            tipo: 'especial',
            estado: 'pendiente',
            monto: mision.valor,
            respuesta: respuesta || '',
            fecha: new Date()
        });

        res.json({
            success: true,
            message: "Reclamo enviado correctamente y pendiente de aprobación",
            data: reclamo
        });

    } catch (error) {
        console.error("Error al reclamar misión especial:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener todos los reclamos registrados (Admin)
 */
const getReclamos = async (req, res) => {
    try {
        const { tipo, estado } = req.query;
        const where = {};
        if (tipo) where.tipo = tipo;
        if (estado) where.estado = estado;

        const reclamos = await MisionReclamo.findAll({
            where,
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id_usuario', 'nombre', 'email', 'imagen_url']
                },
                {
                    model: MisionEspecial,
                    as: 'mision'
                }
            ],
            order: [['fecha', 'DESC']]
        });

        res.json({ success: true, data: reclamos });

    } catch (error) {
        console.error("Error al obtener reclamos:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Procesar (aprobar/rechazar) reclamo (Admin)
 */
const procesarReclamo = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body; // 'aprobado' o 'rechazado'

        if (!['aprobado', 'rechazado'].includes(estado)) {
            return res.status(400).json({ success: false, error: "Estado no válido. Debe ser aprobado o rechazado" });
        }

        const reclamo = await MisionReclamo.findByPk(id);
        if (!reclamo) {
            return res.status(404).json({ success: false, error: "Reclamo no encontrado" });
        }

        if (reclamo.estado !== 'pendiente') {
            return res.status(400).json({ success: false, error: "El reclamo ya fue procesado anteriormente" });
        }

        // Si se aprueba, acreditar el saldo
        if (estado === 'aprobado') {
            const creditoExistente = await CreditoUsuario.findOne({ where: { id_usuario: reclamo.id_usuario } });
            let nuevoMonto = parseFloat(reclamo.monto);
            if (creditoExistente) {
                nuevoMonto += parseFloat(creditoExistente.monto_credito);
            }

            await CreditoUsuario.upsert({
                id_usuario: reclamo.id_usuario,
                monto_credito: parseFloat(nuevoMonto.toFixed(2)),
                fecha: new Date()
            });
        }

        await reclamo.update({ estado });

        res.json({
            success: true,
            message: `Reclamo ${estado === 'aprobado' ? 'aprobado y saldo acreditado' : 'rechazado'} correctamente`,
            data: reclamo
        });

    } catch (error) {
        console.error("Error al procesar reclamo:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener historial de reclamos de misiones de un usuario (para el modal de historial)
 */
const getHistorialUsuario = async (req, res) => {
    try {
        const id_usuario = req.params.id_usuario || req.user?.id_usuario;
        if (!id_usuario) {
            return res.status(400).json({ success: false, error: "Falta id_usuario" });
        }

        const { limit = 20, offset = 0 } = req.query;

        const reclamos = await MisionReclamo.findAll({
            where: { 
                id_usuario,
                [Op.or]: [
                    { tipo: 'auto' }, // Mostrar siempre misiones diarias
                    { tipo: 'especial', estado: 'aprobado' } // Solo mostrar especiales si acertaron (aprobado)
                ]
            },
            order: [['fecha', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Format to match interaction history shape
        const data = reclamos.map(r => ({
            id_unico: `mision_${r.id_reclamo}`,
            _isMision: true,
            tipo: r.tipo === 'auto' ? 'mision_auto' : 'mision_especial',
            descripcion: r.tipo === 'auto' ? 'Misión Diaria' : (r.mision?.titulo || 'Misión Especial'),
            monto_ganado: r.estado === 'aprobado' ? parseFloat(r.monto) : 0,
            monto: parseFloat(r.monto),
            estado: r.estado,
            fecha: r.fecha,
            respuesta: r.respuesta,
            publicacion: null,
            anunciante: null
        }));

        res.json({ success: true, data });

    } catch (error) {
        console.error("Error al obtener historial de misiones:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Finalizar una misión de selección premiando a los que acertaron
 */
const finalizarMisionSeleccion = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id_mision, respuesta_correcta } = req.body;

        if (!id_mision || !respuesta_correcta) {
            await transaction.rollback();
            return res.status(400).json({ success: false, error: "Faltan datos obligatorios" });
        }

        // 1. Obtener todos los reclamos pendientes para esta misión
        const reclamos = await MisionReclamo.findAll({
            where: {
                id_mision,
                tipo: 'especial',
                estado: 'pendiente'
            },
            transaction
        });

        let aprobados = 0;
        let rechazados = 0;

        // 2. Procesar cada reclamo
        for (const reclamo of reclamos) {
            const esCorrecto = reclamo.respuesta === respuesta_correcta;
            const nuevoEstado = esCorrecto ? 'aprobado' : 'rechazado';

            if (esCorrecto) {
                // Acreditar saldo
                const creditoExistente = await CreditoUsuario.findOne({ 
                    where: { id_usuario: reclamo.id_usuario },
                    transaction 
                });
                
                let nuevoMonto = parseFloat(reclamo.monto);
                if (creditoExistente) {
                    nuevoMonto += parseFloat(creditoExistente.monto_credito);
                }

                await CreditoUsuario.upsert({
                    id_usuario: reclamo.id_usuario,
                    monto_credito: parseFloat(nuevoMonto.toFixed(2)),
                    fecha: new Date()
                }, { transaction });
                
                aprobados++;
            } else {
                rechazados++;
            }

            await reclamo.update({ estado: nuevoEstado }, { transaction });
        }

        // 3. Opcional: Desactivar la misión una vez finalizada y guardar la respuesta correcta
        await MisionEspecial.update(
            { 
                activa: false,
                respuesta_correcta: respuesta_correcta
            },
            { where: { id_mision }, transaction }
        );

        await transaction.commit();

        res.json({
            success: true,
            message: `Misión finalizada. ${aprobados} usuarios premiados, ${rechazados} reclamos rechazados.`,
            data: { aprobados, rechazados }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Error al finalizar misión de selección:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Obtener estadísticas de una misión (Admin) con paginación
 */
const getMisionStats = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 10, offset = 0 } = req.query;
        
        const mision = await MisionEspecial.findByPk(id);
        if (!mision) return res.status(404).json({ success: false, error: "Misión no encontrada" });

        // 1. Obtener conteo total para estadísticas globales (sin paginación)
        const totalReclamos = await MisionReclamo.findAll({
            where: { id_mision: id, tipo: 'especial' },
            attributes: ['respuesta', 'estado']
        });

        // 2. Calcular estadísticas básicas globales
        const stats = {
            total: totalReclamos.length,
            respuestas: {},
            correctas: 0,
            incorrectas: 0,
            pendientes: 0
        };

        totalReclamos.forEach(r => {
            const resp = r.respuesta || 'Sin respuesta';
            stats.respuestas[resp] = (stats.respuestas[resp] || 0) + 1;
            
            if (r.estado === 'aprobado') {
                stats.correctas++;
            } else if (r.estado === 'rechazado') {
                stats.incorrectas++;
            } else {
                stats.pendientes++;
            }
        });

        // 3. Obtener reclamos paginados para la lista
        const { count, rows: reclamos } = await MisionReclamo.findAndCountAll({
            where: { id_mision: id, tipo: 'especial' },
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id_usuario', 'nombre', 'email', 'imagen_url']
                }
            ],
            order: [['fecha', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: {
                mision,
                stats,
                reclamos,
                total: count
            }
        });

    } catch (error) {
        console.error("Error al obtener estadísticas de misión:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

/**
 * Procesar múltiples reclamos (Admin)
 */
const procesarReclamosBulk = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { ids, estado } = req.body; // ids: array de ids, estado: 'aprobado' o 'rechazado'

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: "Faltan IDs de reclamos" });
        }

        if (!['aprobado', 'rechazado'].includes(estado)) {
            return res.status(400).json({ success: false, error: "Estado no válido" });
        }

        const reclamos = await MisionReclamo.findAll({
            where: { id_reclamo: ids, estado: 'pendiente' },
            transaction
        });

        let procesados = 0;

        for (const reclamo of reclamos) {
            if (estado === 'aprobado') {
                const creditoExistente = await CreditoUsuario.findOne({ 
                    where: { id_usuario: reclamo.id_usuario },
                    transaction 
                });
                
                let nuevoMonto = parseFloat(reclamo.monto);
                if (creditoExistente) {
                    nuevoMonto += parseFloat(creditoExistente.monto_credito);
                }

                await CreditoUsuario.upsert({
                    id_usuario: reclamo.id_usuario,
                    monto_credito: parseFloat(nuevoMonto.toFixed(2)),
                    fecha: new Date()
                }, { transaction });
            }

            await reclamo.update({ estado }, { transaction });
            procesados++;
        }

        await transaction.commit();

        res.json({
            success: true,
            message: `${procesados} reclamos procesados como ${estado}`,
            data: { procesados }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Error en procesamiento masivo:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
};

module.exports = {
    getMisionesProgress,
    reclamarMisionAuto,
    getMisionesEspeciales,
    listarMisionesAdmin,
    crearMisionAdmin,
    actualizarMisionAdmin,
    eliminarMisionAdmin,
    reclamarMisionEspecial,
    getReclamos,
    procesarReclamo,
    getHistorialUsuario,
    finalizarMisionSeleccion,
    getMisionStats,
    procesarReclamosBulk
};
