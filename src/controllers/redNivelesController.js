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
 * Obtener la vista de red de un usuario (solo nivel 1 directo)
 */
const getMiRed = async (req, res) => {
    try {
        const id_usuario = parseInt(req.params.id_usuario);

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
        const infoRed = await RedNiveles.findOne({
            where: { id_usuario: id_usuario },
            include: [
                { model: Usuario, as: 'usuario', attributes: ['nombre', 'imagen_url'] },
                { model: Usuario, as: 'padre', attributes: ['nombre'] },
                { model: Usuario, as: 'patrocinador', attributes: ['nombre'] }
            ]
        });

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
async function encontrarPosicionSiguiente(id_raiz) {
    let cola = [id_raiz];
    let nivelActual = 1;

    while (cola.length > 0 && nivelActual <= MAX_LEVELS) {
        let siguienteCola = [];
        for (let id_padre of cola) {
            const hijos = await RedNiveles.findAll({ where: { id_padre } });
            
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
        // usar el ID 1 (Empresa) como respaldo
        if (!lugar) {
            lugar = await encontrarPosicionSiguiente(1);
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
        const nodo = await RedNiveles.findOne({ where: { id_usuario } });
        
        if (!nodo || nodo.nivel_actual >= MAX_LEVELS) {
            throw new Error("No se puede subir más de nivel");
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

        // 2. Encontrar quién debe recibir el pago (Salto de niveles)
        // Si sube a Nivel 2, le paga al "abuelo" (2 niveles arriba)
        // Si sube a Nivel 3, le paga al "bisabuelo" (3 niveles arriba)
        let beneficiario = nodo.id_padre;
        for (let i = 1; i < siguienteNivel; i++) {
            if (beneficiario) {
                const parentNode = await RedNiveles.findOne({ where: { id_usuario: beneficiario } });
                beneficiario = parentNode ? parentNode.id_padre : 1; // 1 = Empresa si se acaba la red
            } else {
                beneficiario = 1;
            }
        }
        
        const id_beneficiario = beneficiario || 1;

        // 3. Procesar pagos
        // Descontar al usuario
        await CreditoUsuario.decrement('monto_credito', {
            by: costo,
            where: { id_usuario },
            transaction: t
        });

        // Acreditar al beneficiario
        await CreditoUsuario.increment('monto_credito', {
            by: costo,
            where: { id_usuario: id_beneficiario },
            transaction: t
        });

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
        
        // Estructura inicial del progreso
        let progreso = {
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
                attributes: ['id_usuario']
            });
            
            if (hijos.length === 0) break;
            
            progreso[nivel] = hijos.length;
            idsPadres = hijos.map(h => h.id_usuario);
        }

        // También obtener el nivel actual del usuario
        const miNodo = await RedNiveles.findOne({ where: { id_usuario } });

        res.json({ 
            success: true, 
            data: {
                conteos: progreso,
                mi_nivel: miNodo ? miNodo.nivel_actual : 0
            } 
        });
    } catch (error) {
        console.error('Error al obtener progreso de red:', error);
        res.status(500).json({ success: false, error: "Error al calcular progreso de agencia" });
    }
};

module.exports = {
    getMiRed,
    getHijosDeUsuario,
    getProgresoRed,
    unirseARed,
    subirNivel,
    encontrarPosicionSiguiente
};
