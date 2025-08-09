const ResponseHandler = require('../utils/responseHandler')
const db = require('../models')
const { sequelize } = require("../models")
const { QueryTypes, Transaction } = require('sequelize')
const { Op } = require('sequelize')
const Usuario = db.Usuario
const TransaccionBancaria = db.TransaccionBancaria
const MatrizReferidos = db.MatrizReferido
const ConfiguracionSistema = db.ConfiguracionSistema
const ComisionReferido = db.ComisionReferido
const SaldoUsuario = db.SaldoUsuario

// Función auxiliar para calcular el nivel absoluto desde el referente original
const calcularNivelAbsoluto = async (referenteOriginalId, nodoActualId, transaction) => {
    if (referenteOriginalId === nodoActualId) return 0;

    let nivel = 0;
    let actualId = nodoActualId;

    while (actualId !== referenteOriginalId && nivel < 6) {
        const registro = await MatrizReferidos.findOne({
            where: {
                referidoId: actualId,
                estado: 1
            },
            transaction
        });

        if (!registro) return -1; // No conectado

        nivel++;
        actualId = registro.referenteId;
    }

    return actualId === referenteOriginalId ? nivel : -1;
}

// Función auxiliar para obtener el siguiente espacio disponible en la matriz
const obtenerSiguienteEspacioDisponible = async (referenteOriginalId, transaction) => {
    // Buscar el primer espacio disponible en la red usando BFS (Breadth-First Search)
    const buscarEspacioEnRed = async (nodoId, nivelDesdeReferenteOriginal = 0) => {
        // Si ya estamos en el nivel 5, no podemos agregar más niveles
        if (nivelDesdeReferenteOriginal >= 5) return null;

        // Verificar cuántos referidos directos tiene este nodo
        const referidosDirectos = await MatrizReferidos.count({
            where: {
                referenteId: nodoId,
                estado: 1
            },
            transaction
        });

        // Si tiene menos de 3 referidos directos, hay espacio aquí
        if (referidosDirectos < 3) {
            return {
                nuevoReferenteId: nodoId,
                nivel: 1, // Nivel directo siempre es 1
                nivelAbsoluto: nivelDesdeReferenteOriginal + 1,
                posicion: referidosDirectos + 1
            };
        }

        // Si no hay espacio directo, buscar en los referidos de este nodo
        const referidosDelNodo = await MatrizReferidos.findAll({
            where: {
                referenteId: nodoId,
                estado: 1
            },
            order: [['posicion', 'ASC']],
            transaction
        });

        // Usar una cola para BFS
        const cola = [];

        // Agregar todos los referidos directos a la cola
        for (const referido of referidosDelNodo) {
            cola.push({
                nodoId: referido.referidoId,
                nivel: nivelDesdeReferenteOriginal + 1
            });
        }

        // Procesar la cola
        while (cola.length > 0) {
            const { nodoId: nodoActual, nivel: nivelActual } = cola.shift();

            // Si estamos en el nivel 5, no buscar más profundo
            if (nivelActual >= 5) continue;

            // Verificar si este nodo tiene espacio
            const referidosDeEsteNodo = await MatrizReferidos.count({
                where: {
                    referenteId: nodoActual,
                    estado: 1
                },
                transaction
            });

            if (referidosDeEsteNodo < 3) {
                return {
                    nuevoReferenteId: nodoActual,
                    nivel: 1,
                    nivelAbsoluto: nivelActual + 1,
                    posicion: referidosDeEsteNodo + 1
                };
            }

            // Si no tiene espacio, agregar sus referidos a la cola
            const siguientesReferidos = await MatrizReferidos.findAll({
                where: {
                    referenteId: nodoActual,
                    estado: 1
                },
                order: [['posicion', 'ASC']],
                transaction
            });

            for (const ref of siguientesReferidos) {
                cola.push({
                    nodoId: ref.referidoId,
                    nivel: nivelActual + 1
                });
            }
        }

        return null;
    };

    return await buscarEspacioEnRed(referenteOriginalId, 0);
}

const agregarReferidosMatriz = async (data) => {
    const transaction = await db.sequelize.transaction()
    try {
        const { referenteId, referidos, esForzado = true } = data

        // Validar que el referente existe y es suscriptor
        const referente = await Usuario.findOne({
            where: {
                usuarioId: referenteId,
                esSuscriptor: true,
                estado: 1
            },
            transaction
        })

        if (!referente) {
            await transaction.rollback()
            return ResponseHandler.error('El referente no existe o no es suscriptor activo')
        }

        const resultados = []
        const comisiones = []

        // Obtener cuántos referidos directos tiene actualmente el referente
        const referidosActuales = await MatrizReferidos.count({
            where: {
                referenteId: referenteId,
                estado: 1
            },
            transaction
        })

        let posicionActual = referidosActuales

        // Procesar cada referido
        for (let index = 0; index < referidos.length; index++) {
            const referidoData = referidos[index]
            
            // Verificar si el usuario ya está en la matriz
            const existeEnMatriz = await MatrizReferidos.findOne({
                where: {
                    referidoId: referidoData.usuarioId,
                    estado: 1
                },
                transaction
            })

            if (existeEnMatriz) {
                resultados.push({
                    usuarioId: referidoData.usuarioId,
                    status: 'error',
                    mensaje: 'El usuario ya está en otra red de referidos'
                })
                continue
            }

            // Verificar que el referido es suscriptor
            const referido = await Usuario.findOne({
                where: {
                    usuarioId: referidoData.usuarioId,
                    esSuscriptor: true,
                    estado: 1
                },
                transaction
            })

            if (!referido) {
                resultados.push({
                    usuarioId: referidoData.usuarioId,
                    status: 'error',
                    mensaje: 'El usuario no existe o no es suscriptor'
                })
                continue
            }

            let espacioAsignado = null
            
            // Si NO es forzado, TODOS van al referente original
            if (!esForzado) {
                // Verificar si ya pasamos el límite de 3
                if (posicionActual < 3) {
                    // Asignar directamente al referente original en las primeras 3 posiciones
                    espacioAsignado = {
                        nuevoReferenteId: referenteId,
                        nivel: 1,
                        nivelAbsoluto: 1,
                        posicion: posicionActual + 1,
                        esForzado: false
                    }
                } else {
                    // Después de las primeras 3 posiciones, seguir asignando al referente original
                    // pero marcando como "forzado" porque están ocupando espacios virtuales
                    espacioAsignado = {
                        nuevoReferenteId: referenteId,
                        nivel: 1,
                        nivelAbsoluto: 1,
                        posicion: posicionActual + 1,
                        esForzado: true // Marcamos como forzado porque excede las 3 posiciones
                    }
                }
                posicionActual++
            } else {
                // Si ES forzado, usar la lógica tradicional de spillover
                const espaciosDisponiblesDirectos = 3 - referidosActuales
                
                if (index < espaciosDisponiblesDirectos && espaciosDisponiblesDirectos > 0) {
                    // Aún hay espacio directo con el referente original
                    posicionActual++
                    espacioAsignado = {
                        nuevoReferenteId: referenteId,
                        nivel: 1,
                        nivelAbsoluto: 1,
                        posicion: posicionActual,
                        esForzado: true
                    }
                } else {
                    // Buscar espacio con spillover
                    espacioAsignado = await obtenerSiguienteEspacioDisponible(referenteId, transaction)
                    if (espacioAsignado) {
                        espacioAsignado.esForzado = true
                    }
                }
            }

            if (!espacioAsignado) {
                resultados.push({
                    usuarioId: referidoData.usuarioId,
                    status: 'error',
                    mensaje: 'No hay espacios disponibles en la matriz (máximo 5 niveles)'
                })
                continue
            }

            // Crear el registro en la matriz
            const nuevoRegistro = await MatrizReferidos.create({
                referenteId: espacioAsignado.nuevoReferenteId,
                referidoId: referidoData.usuarioId,
                nivel: espacioAsignado.nivel,
                nivelAbsoluto: espacioAsignado.nivelAbsoluto,
                posicion: espacioAsignado.posicion,
                esForzado: espacioAsignado.esForzado,
                fechaIngreso: new Date(),
                estado: 1
            }, { transaction })

            // Obtener configuración del sistema
            const config = await ConfiguracionSistema.findOne({
                order: [['configuracionId', 'DESC']],
                transaction
            })

            const montoSuscripcion = config ? config.precioSuscripcion : 20
            const porcentajeComision = config ? config.porcentajeComisionNivel : 100

            // Crear comisión para el beneficiario directo
            const comision = await ComisionReferido.create({
                beneficiarioId: espacioAsignado.nuevoReferenteId,
                referidoId: referidoData.usuarioId,
                nivel: espacioAsignado.nivelAbsoluto,
                montoSuscripcion: montoSuscripcion,
                montoComision: (montoSuscripcion * porcentajeComision) / 100,
                fechaGeneracion: new Date(),
                estado: 1
            }, { transaction })

            // Actualizar saldo del beneficiario
            await SaldoUsuario.update({
                saldoPorReferidos: db.sequelize.literal(`saldoPorReferidos + ${comision.montoComision}`),
                saldoDisponible: db.sequelize.literal(`saldoDisponible + ${comision.montoComision}`),
                ultimaActualizacion: new Date()
            }, {
                where: { usuarioId: espacioAsignado.nuevoReferenteId },
                transaction
            })

            comisiones.push(comision)

            resultados.push({
                usuarioId: referidoData.usuarioId,
                status: 'success',
                mensaje: 'Agregado exitosamente a la matriz',
                referenteAsignado: espacioAsignado.nuevoReferenteId,
                nivel: espacioAsignado.nivel,
                nivelEnRed: espacioAsignado.nivelAbsoluto,
                posicion: espacioAsignado.posicion,
                esForzado: espacioAsignado.esForzado,
                comisionGenerada: comision.montoComision
            })
        }

        await transaction.commit()

        return ResponseHandler.success({
            resumen: {
                totalProcesados: referidos.length,
                exitosos: resultados.filter(r => r.status === 'success').length,
                fallidos: resultados.filter(r => r.status === 'error').length
            },
            detalles: resultados,
            comisionesGeneradas: comisiones
        }, 'Proceso de matriz completado')

    } catch (error) {
        await transaction.rollback()
        throw error
    }
}

const obtenerMatrizUsuario = async (usuarioId) => {
    try {
        // Verificar que el usuario existe
        const usuario = await Usuario.findOne({
            where: {
                usuarioId: usuarioId,
                estado: 1
            }
        })

        if (!usuario) {
            return ResponseHandler.error('Usuario no encontrado')
        }

        // Función recursiva para obtener la red completa con niveles correctos
        const obtenerRedCompleta = async (referenteId, nivelActual = 1, referenteOriginalId = null) => {
            if (nivelActual > 5) return []

            // Si es la primera llamada, el referente original es el mismo
            if (!referenteOriginalId) referenteOriginalId = referenteId

            const referidosDirectos = await MatrizReferidos.findAll({
                where: {
                    referenteId: referenteId,
                    estado: 1
                },
                include: [{
                    model: Usuario,
                    as: 'referido',
                    attributes: ['usuarioId', 'nombres', 'apellidos', 'correo', 'fechaSuscripcion']
                }],
                order: [['posicion', 'ASC']]
            })

            const red = []
            for (const referido of referidosDirectos) {
                const descendientes = await obtenerRedCompleta(referido.referidoId, nivelActual + 1, referenteOriginalId)

                red.push({
                    matrizId: referido.matrizId,
                    referenteId: referido.referenteId,
                    referidoId: referido.referidoId,
                    nivel: referido.nivel,
                    nivelAbsoluto: referido.nivelAbsoluto || nivelActual,
                    nivelEnRed: referido.nivelAbsoluto || nivelActual,
                    posicion: referido.posicion,
                    esForzado: referido.esForzado,
                    fechaIngreso: referido.fechaIngreso,
                    referido: referido.referido,
                    descendientes: descendientes
                })
            }

            return red
        }

        const redCompleta = await obtenerRedCompleta(usuarioId)

        // Calcular estadísticas
        const contarMiembros = (red) => {
            let total = red.length
            for (const miembro of red) {
                if (miembro.descendientes) {
                    total += contarMiembros(miembro.descendientes)
                }
            }
            return total
        }

        const contarPorNivel = (red, acumulador = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }) => {
            for (const miembro of red) {
                const nivel = miembro.nivelAbsoluto || miembro.nivelEnRed
                if (nivel >= 1 && nivel <= 5) {
                    acumulador[nivel]++
                }
                if (miembro.descendientes && miembro.descendientes.length > 0) {
                    contarPorNivel(miembro.descendientes, acumulador)
                }
            }
            return acumulador
        }

        const totalMiembros = contarMiembros(redCompleta)
        const estadisticasPorNivel = contarPorNivel(redCompleta)

        // Obtener comisiones generadas
        const comisiones = await ComisionReferido.findAll({
            where: {
                beneficiarioId: usuarioId,
                estado: 1
            },
            include: [{
                model: Usuario,
                as: 'referido',
                attributes: ['nombres', 'apellidos']
            }],
            order: [['fechaGeneracion', 'DESC']]
        })

        const totalComisiones = comisiones.reduce((sum, com) => sum + parseFloat(com.montoComision), 0)

        // Obtener saldo actual
        const saldoUsuario = await SaldoUsuario.findOne({
            where: { usuarioId: usuarioId }
        })

        return ResponseHandler.success({
            usuario: {
                usuarioId: usuario.usuarioId,
                nombres: usuario.nombres,
                apellidos: usuario.apellidos,
                esSuscriptor: usuario.esSuscriptor
            },
            red: redCompleta,
            estadisticas: {
                totalMiembrosEnRed: totalMiembros,
                totalComisionesGeneradas: totalComisiones,
                saldoActual: saldoUsuario ? parseFloat(saldoUsuario.saldoDisponible) : 0,
                cantidadPorNivel: estadisticasPorNivel
            },
            comisiones: comisiones
        }, 'Matriz obtenida exitosamente')

    } catch (error) {
        console.error('Error en obtenerMatrizUsuario:', error)
        throw error
    }
}

module.exports = {
    agregarReferidosMatriz,
    obtenerMatrizUsuario
}