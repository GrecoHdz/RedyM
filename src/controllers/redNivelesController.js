const { sequelize } = require("../config/database");
const RedNiveles = require("../models/redNivelesModel");
const Usuario = require("../models/usuariosModel");
const CreditoUsuario = require("../models/creditoUsuariosModel");
const { Op } = require("sequelize");

// Configuración de la red
const MATRIX_WIDTH = 3;
const MAX_LEVELS = 5;
const LEVEL_COSTS = {
    1: 20,
    2: 40,
    3: 160,
    4: 320,
    5: 640
};

/**
 * Obtener el ID del usuario raíz (el primero registrado)
 */
const getRootUserId = async () => {
    const firstUser = await Usuario.findOne({
        order: [['id_usuario', 'ASC']],
        attributes: ['id_usuario']
    });
    return firstUser ? firstUser.id_usuario : 1;
};

/**
 * Obtener la vista de red de un usuario (solo nivel 1 directo)
 */
const getMiRed = async (req, res) => {
    try {
        const id_usuario = parseInt(req.params.id_usuario);
        const RedNiveles = require("../models/redNivelesModel");
        const Membresia = require("../models/membresiaModel");

        if (id_usuario !== await getRootUserId()) {
            const membresiaReciente = await Membresia.findOne({
                where: { id_usuario },
                order: [['fecha', 'DESC']]
            });

            if (!membresiaReciente) {
                // Si no tiene ninguna membresía, se saca de la matriz
                await RedNiveles.update(
                    { id_padre: null, posicion: null, nivel_actual: 0 },
                    { where: { id_usuario } }
                );
            } else {
                const Config = require("../models/configModel");
                const configGracia = await Config.findOne({ where: { tipo_config: 'dias_gracia_membresia' } });
                const diasGracia = configGracia ? parseInt(configGracia.valor, 10) : 5;
                const diasPermitidos = 30 + diasGracia;

                const hoy = new Date();
                const fechaPago = new Date(membresiaReciente.fecha);
                const diasDiferencia = (hoy - fechaPago) / (1000 * 60 * 60 * 24);

                if (membresiaReciente.estado === 'activa' && diasDiferencia > diasPermitidos) {
                    // Marcar como vencida por tiempo después del periodo de gracia
                    await membresiaReciente.update({ estado: 'vencida' });
                }

                // Se saca de la matriz físicamente si excede el límite de días permitidos (30 + gracia)
                // o si la membresía está rechazada/pendiente de pago inicial
                if (diasDiferencia > diasPermitidos || membresiaReciente.estado === 'rechazada' || membresiaReciente.estado === 'pendiente') {
                    await RedNiveles.update(
                        { id_padre: null, posicion: null, nivel_actual: 0 },
                        { where: { id_usuario } }
                    );
                }
            }
        }

        // 1. Obtener referidos directos primero (quienes el usuario invitó con su link)
        const directos = await RedNiveles.findAll({
            where: { id_patrocinador: id_usuario },
            include: [{ model: Usuario, as: 'usuario', attributes: ['nombre', 'imagen_url'] }]
        });

        const referidosMapped = directos.map(d => ({
            id_usuario: d.id_usuario,
            nombre: d.usuario?.nombre,
            imagen_url: d.usuario?.imagen_url,
            nivel_actual: d.nivel_actual
        }));

        console.log(`[RedController] Referidos directos encontrados para ${id_usuario}:`, directos.length);

        // 2. Obtener mi propia información en la red (puede no existir si es Admin o cuenta antigua)
        let infoRed = await RedNiveles.findOne({
            where: { id_usuario: id_usuario },
            include: [
                { model: Usuario, as: 'usuario', attributes: ['nombre', 'imagen_url'] },
                { model: Usuario, as: 'padre', attributes: ['id_usuario', 'nombre', 'imagen_url'] },
                { model: Usuario, as: 'patrocinador', attributes: ['nombre'] }
            ]
        });

        // AUTO-SANACIÓN: Si es el usuario raíz y no tiene registro, lo aseguramos con findOrCreate
        const rootId = await getRootUserId();
        if (!infoRed && id_usuario === rootId) {
            console.log(`[SelfHealing] Asegurando nodo raíz para ${id_usuario}`);
            await RedNiveles.findOrCreate({
                where: { id_usuario },
                defaults: {
                    id_usuario,
                    nivel_actual: 1,
                    id_patrocinador: id_usuario
                }
            });
            // Recargar con asociaciones después de asegurar existencia
            infoRed = await RedNiveles.findOne({
                where: { id_usuario },
                include: [
                    { model: Usuario, as: 'usuario', attributes: ['nombre', 'imagen_url'] },
                    { model: Usuario, as: 'padre', attributes: ['id_usuario', 'nombre', 'imagen_url'] },
                    { model: Usuario, as: 'patrocinador', attributes: ['nombre'] }
                ]
            });
        }

        // 3. Obtener hijos directos en la matriz (quienes están justo debajo en el árbol 3x5)
        // Se buscan SIEMPRE, incluso si el usuario no tiene su propio registro en RedNiveles aún
        const hijos = await RedNiveles.findAll({
            where: { 
                id_padre: id_usuario,
                nivel_actual: { [Op.gt]: 0 }
            },
            include: [{ model: Usuario, as: 'usuario', attributes: ['id_usuario', 'nombre', 'imagen_url'] }]
        });

        const infoBase = infoRed ? infoRed.toJSON() : {
            id_usuario: id_usuario,
            nivel_actual: 0,
            posicion: 0,
            id_padre: null,
            id_patrocinador: null
        };

        res.json({
            success: true,
            data: {
                ...infoBase,
                hijos: hijos.map(h => ({
                    id_usuario: h.id_usuario,
                    nombre: h.usuario?.nombre || 'Miembro',
                    imagen_url: h.usuario?.imagen_url,
                    nivel_actual: h.nivel_actual,
                    posicion: h.posicion
                })),
                referidosDirectos: referidosMapped
            }
        });
    } catch (error) {
        console.error('Error al obtener red:', error);
        res.status(500).json({ success: false, error: "Error al obtener la red" });
    }
};

/**
 * Obtener los hijos de un usuario específico para la navegación recursiva en modales
 */
const getHijosDeUsuario = async (req, res) => {
    try {
        const id_padre = parseInt(req.params.id_padre);
        const hijos = await RedNiveles.findAll({
            where: { 
                id_padre,
                nivel_actual: { [Op.gt]: 0 }
            },
            include: [{ model: Usuario, as: 'usuario', attributes: ['nombre', 'imagen_url'] }],
            order: [['posicion', 'ASC']]
        });

        res.json({
            success: true,
            data: hijos.map(h => ({
                id_usuario: h.id_usuario,
                nombre: h.usuario?.nombre || 'Miembro',
                imagen_url: h.usuario?.imagen_url,
                nivel_actual: h.nivel_actual,
                posicion: h.posicion
            }))
        });
    } catch (error) {
        console.error('Error al obtener hijos:', error);
        res.status(500).json({ success: false, error: "Error al obtener nivel de red" });
    }
};

/**
 * Función interna para encontrar la primera posición libre en la matriz 3x5 (Derrame)
 */
async function encontrarPosicionSiguiente(id_raiz, transaction = null) {
    let cola = [id_raiz];
    let nivelActual = 1;

    while (cola.length > 0 && nivelActual <= MAX_LEVELS) {
        let siguienteCola = [];
        for (let id_padre of cola) {
            const hijos = await RedNiveles.findAll({ 
                where: { id_padre },
                transaction
            });
            
            if (hijos.length < MATRIX_WIDTH) {
                // Determinar cual posición (1, 2 o 3) está libre
                const posicionesOcupadas = hijos.map(h => h.posicion);
                for (let pos = 1; pos <= MATRIX_WIDTH; pos++) {
                    if (!posicionesOcupadas.includes(pos)) {
                        return { id_padre, posicion: pos };
                    }
                }
            }
            
            // Si el padre está lleno, agregamos sus hijos a la cola para el siguiente nivel de profundidad
            siguienteCola.push(...hijos.map(h => h.id_usuario));
        }
        cola = siguienteCola;
        nivelActual++;
    }
    return null; // Red llena (?)
}

/**
 * Registrar un nuevo usuario en la red y manejar pagos de niveles
 */
const unirseARed = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id_usuario, id_patrocinador } = req.body;

        // 1. Validar que no esté en la red
        const existe = await RedNiveles.findOne({ where: { id_usuario } });
        if (existe) throw new Error("El usuario ya pertenece a la red");

        // 2. Encontrar lugar por derrame (spillover) debajo del patrocinador
        // Si el patrocinador no tiene lugar, busca hacia abajo en su red
        let lugar = await encontrarPosicionSiguiente(id_patrocinador);
        
        // 3. Si por alguna razón el patrocinador no sirve (ej. no existe en red), 
        // usar el primer usuario como respaldo
        if (!lugar) {
            const rootId = await getRootUserId();
            lugar = await encontrarPosicionSiguiente(rootId);
        }

        if (!lugar) throw new Error("No hay espacios disponibles en la red");

        // 4. Crear el registro en la red
        const nuevoNodo = await RedNiveles.create({
            id_usuario,
            id_padre: lugar.id_padre,
            id_patrocinador,
            posicion: lugar.posicion,
            nivel_actual: 1 // Entra con nivel 1
        }, { transaction: t });

        // 5. MANEJO DE COMISIONES (Lógica 100%)
        // Obtener costo de entrada dinámico de la tabla Config
        const Config = require("../models/configModel");
        const configMembresia = await Config.findOne({ 
            where: { tipo_config: 'valor_membresia' } 
        });
        
        const costoEntrada = configMembresia ? parseFloat(configMembresia.valor) : 500; // Default proporcionado por el usuario
        
        // Actualizar saldo del patrocinador
        await CreditoUsuario.increment('monto_credito', {
            by: costoEntrada,
            where: { id_usuario: id_patrocinador },
            transaction: t
        });

        // (Opcional: Crear registro de movimiento financiero aquí)

        await t.commit();
        res.status(201).json({ success: true, data: nuevoNodo });

    } catch (error) {
        await t.rollback();
        console.error('Error al unirse a red:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Subir de nivel (Upgrade)
 */
const subirNivel = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id_usuario } = req.body;
        console.log(`[subirNivel] Solicitado por ${id_usuario}`);
        const nodo = await RedNiveles.findOne({ where: { id_usuario } });
        console.log(`[subirNivel] Nodo encontrado:`, nodo ? { id: nodo.id_usuario, nivel: nodo.nivel_actual } : 'NULL');
        
        if (!nodo) {
            console.error(`[subirNivel] Error: No se encontró registro de red para el usuario ${id_usuario}`);
            throw new Error("No estás registrado en la red");
        }

        if (nodo.nivel_actual >= MAX_LEVELS) {
            console.error(`[subirNivel] Error: Usuario ${id_usuario} ya está en el nivel máximo (${nodo.nivel_actual}/${MAX_LEVELS})`);
            throw new Error(`Ya has alcanzado el nivel máximo (${MAX_LEVELS})`);
        }

        const siguienteNivel = nodo.nivel_actual + 1;
        
        // Obtener costo del nivel dinámicamente
        const Config = require("../models/configModel");
        const configNivel = await Config.findOne({ 
            where: { tipo_config: `nivel${siguienteNivel}_costo` } 
        });

        const costo = configNivel ? parseFloat(configNivel.valor) : LEVEL_COSTS[siguienteNivel];

        // 1. Validar saldo del usuario
        const saldo = await CreditoUsuario.findOne({ where: { id_usuario } });
        if (!saldo || saldo.monto_credito < costo) {
            throw new Error(`Saldo insuficiente. Necesitas $${costo} para subir al nivel ${siguienteNivel}`);
        }

        // 2. Encontrar quién debe recibir el pago (Compresión Dinámica)
        // El pago corresponde al N-ésimo nivel arriba, pero el receptor debe ser mínimo ese nivel
        let id_beneficiario = null;
        let actual = nodo.id_padre;
        const rootId = await getRootUserId();

        // Primero saltamos N-1 veces para llegar al receptor teórico
        for (let i = 1; i < siguienteNivel; i++) {
            if (actual) {
                const p = await RedNiveles.findOne({ where: { id_usuario: actual } });
                actual = p ? p.id_padre : rootId;
            } else {
                actual = rootId;
            }
        }
        
        // Aplicar Compresión: Buscar hacia arriba hasta hallar a alguien con nivel >= siguienteNivel
        let calificado = false;
        let bActual = actual;

        while (!calificado && bActual && bActual !== rootId) {
            const bNode = await RedNiveles.findOne({ where: { id_usuario: bActual } });
            if (bNode && bNode.nivel_actual >= siguienteNivel) {
                calificado = true;
                id_beneficiario = bActual;
            } else {
                // Si no está calificado, saltamos al siguiente padre
                bActual = bNode ? bNode.id_padre : rootId;
            }
        }
        
        // Si nadie está calificado en la línea ascendente, el pago va a la cuenta raíz
        if (!calificado) id_beneficiario = rootId;

        // 3. Procesar pagos
        const saldoUsuario = await CreditoUsuario.findOne({ where: { id_usuario }, transaction: t });
        let montoFinalUser = parseFloat(saldoUsuario ? saldoUsuario.monto_credito : 0) - costo;
        montoFinalUser = parseFloat(montoFinalUser.toFixed(2));

        await CreditoUsuario.upsert({
            id_usuario,
            monto_credito: montoFinalUser,
            fecha: new Date()
        }, { transaction: t });
        console.log(`[subirNivel] 💸 Saldo Usuario ${id_usuario} actualizado a: $${montoFinalUser}`);

        const saldoBeneficiario = await CreditoUsuario.findOne({ where: { id_usuario: id_beneficiario }, transaction: t });
        let montoFinalBen = parseFloat(saldoBeneficiario ? saldoBeneficiario.monto_credito : 0) + costo;
        montoFinalBen = parseFloat(montoFinalBen.toFixed(2));

        await CreditoUsuario.upsert({
            id_usuario: id_beneficiario,
            monto_credito: montoFinalBen,
            fecha: new Date()
        }, { transaction: t });
        console.log(`[subirNivel] 💰 Saldo Beneficiario ${id_beneficiario} actualizado a: $${montoFinalBen}`);

        // 4. Actualizar nivel
        await nodo.update({ nivel_actual: siguienteNivel }, { transaction: t });

        await t.commit();
        res.json({ success: true, nivel_nuevo: siguienteNivel });

    } catch (error) {
        await t.rollback();
        console.error('Error en upgrade:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener el conteo de personas en cada nivel de la agencia (Progreso)
 */
const getProgresoRed = async (req, res) => {
    try {
        const id_usuario = parseInt(req.params.id_usuario);
        const Membresia = require("../models/membresiaModel");

        // Sincronizar estado antes de calcular progreso
        // Ignorar si es el ID raíz
        const rootId = await getRootUserId();
        if (id_usuario !== rootId) {
            const m = await Membresia.findOne({
                where: { id_usuario },
                order: [['fecha', 'DESC']]
            });

            if (!m) {
                await RedNiveles.update({ id_padre: null, posicion: null, nivel_actual: 0 }, { where: { id_usuario } });
            } else {
                const Config = require("../models/configModel");
                const configGracia = await Config.findOne({ where: { tipo_config: 'dias_gracia_membresia' } });
                const diasGracia = configGracia ? parseInt(configGracia.valor, 10) : 5;
                const diasPermitidos = 30 + diasGracia;

                const hoy = new Date();
                const fechaM = new Date(m.fecha);
                const diasDiferencia = (hoy - fechaM) / (1000 * 60 * 60 * 24);

                if (m.estado === 'activa' && diasDiferencia > diasPermitidos) {
                    await m.update({ estado: 'vencida' });
                }

                if (diasDiferencia > diasPermitidos || m.estado === 'rechazada' || m.estado === 'pendiente') {
                    await RedNiveles.update({ id_padre: null, posicion: null, nivel_actual: 0 }, { where: { id_usuario } });
                }
            }
        }
        
        // Estructura inicial del progreso y cobrados
        let progreso = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0
        };
        let pagados = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0
        };

        // Búsqueda por niveles (BFS simplificado)
        // Solo contamos usuarios que tienen nivel_actual > 0 (activos)
        let idsPadres = [parseInt(id_usuario)];
        for (let nivel = 1; nivel <= MAX_LEVELS; nivel++) {
            const hijos = await RedNiveles.findAll({
                where: { 
                    id_padre: { [Op.in]: idsPadres },
                    nivel_actual: { [Op.gt]: 0 } // Solo contar los activos en la matriz
                },
                attributes: ['id_usuario', 'nivel_actual', 'id_patrocinador']
            });
            
            if (hijos.length === 0) break;
            
            progreso[nivel] = hijos.length;

            // Calcular cuántos de estos hijos ya generaron cobro para este nivel
            if (nivel === 1) {
                // En el nivel 1 solo gana de los que son sus patrocinados directos
                pagados[1] = hijos.filter(h => h.id_patrocinador === parseInt(id_usuario)).length;
            } else {
                // En niveles 2 a 5 gana de los que tienen nivel_actual >= nivel
                pagados[nivel] = hijos.filter(h => h.nivel_actual >= nivel).length;
            }
            
            idsPadres = hijos.map(h => h.id_usuario);
        }

        // También obtener el nivel actual del usuario
        let miNodo = await RedNiveles.findOne({ where: { id_usuario } });

        // AUTO-SANACIÓN: Si es raíz y no tiene nodo, lo aseguramos aquí también
        if (!miNodo && id_usuario === rootId) {
            console.log(`[SelfHealing-Progreso] Asegurando nodo raíz para ${id_usuario}`);
            await RedNiveles.findOrCreate({
                where: { id_usuario },
                defaults: { id_usuario, nivel_actual: 1, id_patrocinador: id_usuario }
            });
            miNodo = await RedNiveles.findOne({ where: { id_usuario } });
        }

        res.json({ 
            success: true, 
            data: {
                conteos: progreso,
                pagados: pagados,
                mi_nivel: miNodo ? miNodo.nivel_actual : 0
            } 
        });
    } catch (error) {
        console.error('Error al obtener progreso de red:', error);
        res.status(500).json({ success: false, error: "Error al calcular progreso de agencia" });
    }
};

/**
 * Lógica interna para procesar un upgrade (sin requerir req/res)
 * Útil para disparar upgrades automáticos desde otros procesos como la aprobación de membresía
 */
const procesarAutoUpgradeInterno = async (id_usuario, t_existente = null) => {
    const t = t_existente || await sequelize.transaction();
    try {
        console.log(`[AutoUpgrade] 🔍 Verificando condiciones para Usuario ${id_usuario}`);
        const nodo = await RedNiveles.findOne({ where: { id_usuario }, transaction: t });
        
        if (!nodo) {
            console.log(`[AutoUpgrade] ⚠️ No se encontró registro en matriz para ${id_usuario}.`);
            return;
        }

        if (nodo.nivel_actual === 0) {
            console.log(`[AutoUpgrade] ⏭️ Usuario ${id_usuario} está en Nivel 0 (Inactivo), saltando.`);
            return;
        }

        if (nodo.nivel_actual >= MAX_LEVELS) {
            console.log(`[AutoUpgrade] ✅ Usuario ${id_usuario} ya está en el nivel máximo (${MAX_LEVELS}).`);
            return;
        }

        const siguienteNivel = nodo.nivel_actual + 1;
        console.log(`[AutoUpgrade] 📈 Usuario ${id_usuario} está en Nivel ${nodo.nivel_actual}. Objetivo: Nivel ${siguienteNivel}`);

        // Regla: Para pasar de L1 a L2 necesita 3 hijos directos activos en matriz
        if (nodo.nivel_actual === 1) {
            const hijosCount = await RedNiveles.count({ 
                where: { id_padre: id_usuario, nivel_actual: { [Op.gt]: 0 } },
                transaction: t
            });
            console.log(`[AutoUpgrade] 👥 Red L1 del Usuario ${id_usuario}: ${hijosCount}/3 miembros activos.`);
            if (hijosCount < 3) {
                console.log(`[AutoUpgrade] ⏳ Faltan miembros en L1 para calificar al Nivel 2.`);
                return;
            }
        }

        // Obtener costo
        const Config = require("../models/configModel");
        const configNivel = await Config.findOne({ 
            where: { tipo_config: `nivel${siguienteNivel}_costo` },
            transaction: t
        });
        const costo = configNivel ? parseFloat(configNivel.valor) : LEVEL_COSTS[siguienteNivel];

        // Validar saldo
        const saldo = await CreditoUsuario.findOne({ where: { id_usuario }, transaction: t });
        const canAfford = saldo && saldo.monto_credito >= costo;
        
        console.log(`[AutoUpgrade] 💰 Saldo de Usuario ${id_usuario}: $${saldo ? saldo.monto_credito : 0}. Costo Nivel ${siguienteNivel}: $${costo}`);
        
        if (!canAfford) {
            console.log(`[AutoUpgrade] ❌ Saldo insuficiente para upgrade automático.`);
            return;
        }

        console.log(`[AutoUpgrade] 🚀 ¡Condiciones cumplidas! Procesando upgrade al Nivel ${siguienteNivel}...`);

        // Encontrar beneficiario con Compresión Dinámica
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

        console.log(`[AutoUpgrade] 💸 Beneficiario de comisión (Nivel ${siguienteNivel}): Usuario ${id_beneficiario}`);

        // Ejecutar transacciones financieras
        const saldoUsuario = await CreditoUsuario.findOne({ where: { id_usuario }, transaction: t });
        let montoFinalUser = parseFloat(saldoUsuario ? saldoUsuario.monto_credito : 0) - costo;
        montoFinalUser = parseFloat(montoFinalUser.toFixed(2));

        await CreditoUsuario.upsert({
            id_usuario,
            monto_credito: montoFinalUser,
            fecha: new Date()
        }, { transaction: t });
        console.log(`[AutoUpgrade] 💸 Saldo Usuario ${id_usuario} actualizado a: $${montoFinalUser}`);

        const saldoBeneficiario = await CreditoUsuario.findOne({ where: { id_usuario: id_beneficiario }, transaction: t });
        let montoFinalBen = parseFloat(saldoBeneficiario ? saldoBeneficiario.monto_credito : 0) + costo;
        montoFinalBen = parseFloat(montoFinalBen.toFixed(2));

        await CreditoUsuario.upsert({
            id_usuario: id_beneficiario,
            monto_credito: montoFinalBen,
            fecha: new Date()
        }, { transaction: t });
        console.log(`[AutoUpgrade] 💰 Saldo Beneficiario ${id_beneficiario} actualizado a: $${montoFinalBen}`);
        
        await nodo.update({ nivel_actual: siguienteNivel }, { transaction: t });

        if (!t_existente) await t.commit();
        console.log(`[AutoUpgrade] ✨ ¡ÉXITO! Usuario ${id_usuario} ha subido al Nivel ${siguienteNivel} automáticamente.`);
        
        // RECURSIVIDAD: Intentar subir al siguiente nivel si ya tiene las condiciones para el que sigue
        await procesarAutoUpgradeInterno(id_usuario, t);

    } catch (error) {
        if (!t_existente) await t.rollback();
        console.error(`[AutoUpgrade] Error procesando upgrade para ${id_usuario}:`, error.message);
    }
};

/**
 * Reconstrucción completa de la red (sanación)
 * Reevalúa todas las membresías, saca de la red a los inactivos
 * y re-coloca secuencialmente a los activos según derrame de sus patrocinadores activos o la raíz.
 */
const actualizarRedCompleta = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const rootId = await getRootUserId();

        // 1. Obtener todos los usuarios registrados
        const usuarios = await Usuario.findAll({
            order: [['id_usuario', 'ASC']],
            transaction: t
        });

        // 2. Obtener configuración de días de gracia
        const Config = require("../models/configModel");
        const configGracia = await Config.findOne({ 
            where: { tipo_config: 'dias_gracia_membresia' },
            transaction: t
        });
        const diasGracia = configGracia ? parseInt(configGracia.valor, 10) : 5;
        const diasPermitidos = 30 + diasGracia;
        const hoy = new Date();

        // Mapa para controlar la vigencia del usuario en la red
        const usuarioActivoMap = {};
        
        // La cuenta raíz siempre está activa
        usuarioActivoMap[rootId] = true;

        const Membresia = require("../models/membresiaModel");

        // 3. Evaluar membresías
        for (const usuario of usuarios) {
            const id_usuario = usuario.id_usuario;
            if (id_usuario === rootId) continue;

            // Si el estado del usuario es inactivo o deshabilitado, se saca de la red
            if (usuario.estado !== 'activo') {
                usuarioActivoMap[id_usuario] = false;
                continue;
            }

            const membresiaReciente = await Membresia.findOne({
                where: { id_usuario },
                order: [['fecha', 'DESC']],
                transaction: t
            });

            let activo = false;

            if (membresiaReciente) {
                const fechaPago = new Date(membresiaReciente.fecha);
                const diasDiferencia = (hoy - fechaPago) / (1000 * 60 * 60 * 24);

                if (membresiaReciente.estado === 'activa' && diasDiferencia > diasPermitidos) {
                    await membresiaReciente.update({ estado: 'vencida' }, { transaction: t });
                }

                // Considerar activo si está dentro de días permitidos (30 + gracia) y no está rechazada ni pendiente
                if (diasDiferencia <= diasPermitidos && membresiaReciente.estado !== 'rechazada' && membresiaReciente.estado !== 'pendiente') {
                    activo = true;
                }
            }

            usuarioActivoMap[id_usuario] = activo;
        }

        // 3b. Calcular la próxima fecha de vencimiento entre todos los usuarios activos en red
        // Buscamos la membresía activa más antigua (la que vence primero)
        let proximaFechaVencimiento = null;
        for (const usuario of usuarios) {
            const id_usuario = usuario.id_usuario;
            if (id_usuario === rootId) continue;
            if (!usuarioActivoMap[id_usuario]) continue;

            const membresiaReciente = await Membresia.findOne({
                where: { id_usuario },
                order: [['fecha', 'DESC']],
                transaction: t
            });

            if (membresiaReciente) {
                const fechaPago = new Date(membresiaReciente.fecha);
                const fechaVencimiento = new Date(fechaPago.getTime() + diasPermitidos * 24 * 60 * 60 * 1000);

                if (!proximaFechaVencimiento || fechaVencimiento < proximaFechaVencimiento) {
                    proximaFechaVencimiento = fechaVencimiento;
                }
            }
        }

        // 4. Limpiar padres y posiciones de todos los usuarios excepto root
        // Esto permite reconstruir la red libre de colisiones o referencias antiguas rotas
        await RedNiveles.update(
            { id_padre: null, posicion: null },
            { 
                where: { 
                    id_usuario: { [Op.ne]: rootId } 
                },
                transaction: t 
            }
        );

        // 5. Asegurar existencia de registros en RedNiveles y desactivar los que corresponden
        for (const usuario of usuarios) {
            const id_usuario = usuario.id_usuario;
            if (id_usuario === rootId) continue;

            const activo = usuarioActivoMap[id_usuario];
            
            let nodo = await RedNiveles.findOne({ where: { id_usuario }, transaction: t });
            if (!nodo) {
                const patrocinadorId = usuario.id_patrocinador || rootId;
                nodo = await RedNiveles.create({
                    id_usuario,
                    id_patrocinador: patrocinadorId,
                    nivel_actual: 0,
                    id_padre: null,
                    posicion: null
                }, { transaction: t });
            }

            if (!activo) {
                await nodo.update({ nivel_actual: 0, id_padre: null, posicion: null }, { transaction: t });
            }
        }

        // 6. Colocar de forma secuencial y en orden (por id_usuario ASC) a los usuarios activos
        for (const usuario of usuarios) {
            const id_usuario = usuario.id_usuario;
            if (id_usuario === rootId) continue;

            if (usuarioActivoMap[id_usuario]) {
                const nodo = await RedNiveles.findOne({ where: { id_usuario }, transaction: t });
                let id_patrocinador = nodo ? nodo.id_patrocinador : rootId;

                // Subir en la línea de patrocinio si el patrocinador actual no está activo
                let sponsorNodo = await RedNiveles.findOne({ where: { id_usuario: id_patrocinador }, transaction: t });
                
                let startNodeId = id_patrocinador;
                if (id_patrocinador !== rootId && (!sponsorNodo || sponsorNodo.id_padre === null)) {
                    let auxPatrocinador = id_patrocinador;
                    let auxNodo = sponsorNodo;
                    while (auxPatrocinador !== rootId && (!auxNodo || auxNodo.id_padre === null)) {
                        auxPatrocinador = auxNodo ? auxNodo.id_patrocinador : rootId;
                        auxNodo = await RedNiveles.findOne({ where: { id_usuario: auxPatrocinador }, transaction: t });
                    }
                    startNodeId = auxPatrocinador;
                }

                // Encontrar espacio libre usando spillover
                let lugar = await encontrarPosicionSiguiente(startNodeId, t);
                if (!lugar) {
                    lugar = await encontrarPosicionSiguiente(rootId, t);
                }

                if (lugar) {
                    const nuevoNivel = (nodo && nodo.nivel_actual > 0) ? nodo.nivel_actual : 1;
                    await nodo.update({
                        id_padre: lugar.id_padre,
                        posicion: lugar.posicion,
                        nivel_actual: nuevoNivel
                    }, { transaction: t });
                } else {
                    console.error(`[actualizarRedCompleta] Sin espacio disponible en la matriz para el usuario ${id_usuario}`);
                }
            }
        }

        await t.commit();
        res.json({
            success: true,
            message: "Red de niveles reconstruida y sanada con éxito",
            proximaFechaVencimiento: proximaFechaVencimiento ? proximaFechaVencimiento.toISOString() : null
        });
    } catch (error) {
        await t.rollback();
        console.error("Error al actualizar red completa:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getMiRed,
    getHijosDeUsuario,
    getProgresoRed,
    unirseARed,
    subirNivel,
    procesarAutoUpgradeInterno,
    encontrarPosicionSiguiente,
    actualizarRedCompleta
};
