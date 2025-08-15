const ResponseHandler = require('../utils/responseHandler')
const db = require('../models')
const { sequelize } = require("../models")
const { QueryTypes, Transaction, } = require('sequelize')
const { Op } = require('sequelize')
const { cloudinary } = require('../middlewares/uploadMiddleware')

// Modelos
const Usuario = db.Usuario
const AdjuntoPublicacion = db.AdjuntoPublicacion
const TipoPublicacion = db.TipoPublicacion
const Publicacion = db.Publicacion

// Función para subir un solo archivo a Cloudinary
const uploadSingleFile = async (file) => {
    try {
        let uploadOptions = {
            resource_type: 'auto', // Detecta automáticamente si es imagen o video
            quality: 'auto:good',
            fetch_format: 'auto'
        };

        // Configuración específica según el tipo de archivo
        if (file.mimetype.startsWith('image/')) {
            uploadOptions = {
                ...uploadOptions,
                folder: 'imagenes_usuarios',
                transformation: [{
                    width: 1200,
                    height: 1200,
                    crop: 'fill', // Cambiado de 'limit' a 'fill'
                    gravity: 'auto:subject',
                    quality: 'auto:good',
                    format: 'webp'
                }]
            };
        } else if (file.mimetype.startsWith('video/')) {
            uploadOptions = {
                ...uploadOptions,
                folder: 'videos_usuarios',
                resource_type: 'video',
                transformation: [{
                    width: 1280,
                    height: 720,
                    crop: 'fill', // Cambiado de 'limit' a 'fill'
                    gravity: 'center', // Cambiado gravity para videos
                    quality: 'auto:good',
                    video_codec: 'h264',
                    audio_codec: 'aac',
                    bit_rate: '1000k',
                    format: 'mp4'
                }]
            };
        }

        // Convertir buffer a base64 para subir
        const base64String = file.buffer.toString('base64');
        const dataUri = `data:${file.mimetype};base64,${base64String}`;

        const result = await cloudinary.uploader.upload(dataUri, uploadOptions);
        
        return {
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            size: result.bytes
        };
    } catch (error) {
        console.error('Error subiendo archivo a Cloudinary:', error);
        throw new Error(`Error al subir archivo: ${error.message}`);
    }
};

// Función para eliminar archivo de Cloudinary
const deleteFileFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        return result.result === 'ok';
    } catch (error) {
        console.error('Error eliminando archivo de Cloudinary:', error);
        return false;
    }
};

const createPublicacion = async (data) => {
    const transaction = await db.sequelize.transaction()
    try {
        const {
            usuarioId,
            tipoPublicacionId,
            titulo,
            descripcion, // Corregido el typo
            adjuntos // Array de archivos
        } = data

        // Validaciones iniciales
        if (!adjuntos || adjuntos.length === 0) {
            await transaction.rollback()
            return ResponseHandler.error('Debe proporcionar al menos un adjunto')
        }

        if (adjuntos.length > 10) {
            await transaction.rollback()
            return ResponseHandler.error('No se pueden subir más de 10 adjuntos por publicación')
        }

        // Validar usuario
        const usuario = await Usuario.findOne({
            where: {
                usuarioId: usuarioId,
            },
            transaction
        })

        if (!usuario) {
            await transaction.rollback()
            return ResponseHandler.error('Usuario no encontrado')
        }

        if (usuario.esSuscriptor === false) {
            await transaction.rollback()
            return ResponseHandler.error('Este usuario no es un suscriptor, no puede crear publicaciones')
        }

        if (usuario.estado === false) {
            await transaction.rollback()
            return ResponseHandler.error('Este usuario no está activo, no puede crear publicaciones')
        }

        // Validar tipo de publicación
        const tipoPublicacion = await TipoPublicacion.findOne({
            where: {
                tipoPublicacionId: tipoPublicacionId,
            },
            transaction
        })

        if (!tipoPublicacion || tipoPublicacion.estado === false) {
            await transaction.rollback()
            return ResponseHandler.error('Tipo de publicación no encontrado o inactivo')
        }

        // Crear la publicación
        const publicacion = await Publicacion.create({
            usuarioId: usuarioId,
            tipoPublicacionId: tipoPublicacionId,
            titulo: titulo,
            descripcion: descripcion, // Corregido
            fechaPublicacion: new Date(),
            estado: true
        }, { transaction })

        console.log(`Creada publicación con ID: ${publicacion.publicacionId}`)

        // Array para almacenar los adjuntos subidos (para cleanup en caso de error)
        const adjuntosSubidos = []

        // Subir cada archivo y crear registro en AdjuntoPublicacion
        for (let i = 0; i < adjuntos.length; i++) {
            const archivo = adjuntos[i]
            
            console.log(`Subiendo archivo ${i + 1}/${adjuntos.length}: ${archivo.originalname}`)
            
            // Subir archivo a Cloudinary
            const archivoSubido = await uploadSingleFile(archivo)
            adjuntosSubidos.push(archivoSubido)

            // Crear registro en AdjuntoPublicacion
            await AdjuntoPublicacion.create({
                publicacionId: publicacion.publicacionId,
                urlAdjunto: archivoSubido.url,
                orden: i + 1, // El orden según la posición en el array
                estado: true
            }, { transaction })

            console.log(`Archivo ${i + 1} subido exitosamente: ${archivoSubido.url}`)
        }

        // Si llegamos aquí, todo salió bien - confirmar transacción
        await transaction.commit()

        console.log('Publicación creada exitosamente')
        
        // Retornar respuesta simple sin relaciones por ahora
        const publicacionResponse = {
            publicacionId: publicacion.publicacionId,
            usuarioId: publicacion.usuarioId,
            tipoPublicacionId: publicacion.tipoPublicacionId,
            titulo: publicacion.titulo,
            descripcion: publicacion.descripcion,
            fechaPublicacion: publicacion.fechaPublicacion,
            estado: publicacion.estado,
            totalAdjuntos: adjuntos.length,
            adjuntosUrls: adjuntosSubidos.map((archivo, index) => ({
                orden: index + 1,
                url: archivo.url,
                tipo: archivo.resourceType
            }))
        }

        return ResponseHandler.success(publicacionResponse, 'Publicación creada exitosamente')

    } catch (error) {
        console.error('Error en createPublicacion:', error)
        
        // Solo hacer rollback si la transacción no ha sido commitada
        if (!transaction.finished) {
            await transaction.rollback()
        }
        
        throw error
    }
}

const getPublicacionById = async (publicacionId) => {
    try {
        const publicacion = await Publicacion.findOne({
            where: { 
                publicacionId: publicacionId,
                estado: true 
            }
        })

        if (!publicacion) {
            return ResponseHandler.error('Publicación no encontrada')
        }

        // Obtener adjuntos por separado
        const adjuntos = await AdjuntoPublicacion.findAll({
            where: { 
                publicacionId: publicacionId,
                estado: true 
            },
            order: [['orden', 'ASC']]
        })

        // Obtener datos del usuario
        const usuario = await Usuario.findOne({
            where: { usuarioId: publicacion.usuarioId },
            attributes: ['usuarioId', 'nombres', 'apellidos', 'correo']
        })

        // Obtener tipo de publicación
        const tipoPublicacion = await TipoPublicacion.findOne({
            where: { tipoPublicacionId: publicacion.tipoPublicacionId },
            attributes: ['tipoPublicacionId', 'descripcion']
        })

        const publicacionCompleta = {
            ...publicacion.toJSON(),
            usuario: usuario,
            tipoPublicacion: tipoPublicacion,
            adjuntos: adjuntos
        }

        return ResponseHandler.success(publicacionCompleta)
    } catch (error) {
        console.error('Error en getPublicacionById:', error)
        throw error
    }
}

const getAllPublicaciones = async (limit = 20, offset = 0) => {
    try {
        const publicaciones = await Publicacion.findAndCountAll({
            where: { estado: true },
            order: [['fechaPublicacion', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        })

        // Obtener datos adicionales para cada publicación
        const publicacionesCompletas = await Promise.all(
            publicaciones.rows.map(async (publicacion) => {
                // Obtener adjuntos
                const adjuntos = await AdjuntoPublicacion.findAll({
                    where: { 
                        publicacionId: publicacion.publicacionId,
                        estado: true 
                    },
                    order: [['orden', 'ASC']]
                })

                // Obtener datos del usuario
                const usuario = await Usuario.findOne({
                    where: { usuarioId: publicacion.usuarioId },
                    attributes: ['usuarioId', 'nombres', 'apellidos', 'correo']
                })

                // Obtener tipo de publicación
                const tipoPublicacion = await TipoPublicacion.findOne({
                    where: { tipoPublicacionId: publicacion.tipoPublicacionId },
                    attributes: ['tipoPublicacionId', 'descripcion']
                })

                return {
                    ...publicacion.toJSON(),
                    usuario: usuario,
                    tipoPublicacion: tipoPublicacion,
                    adjuntos: adjuntos
                }
            })
        )

        return ResponseHandler.success({
            publicaciones: publicacionesCompletas,
            total: publicaciones.count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        })
    } catch (error) {
        console.error('Error en getAllPublicaciones:', error)
        throw error
    }
}

const deletePublicacion = async (publicacionId, usuarioId) => {
    const transaction = await db.sequelize.transaction()
    try {
        // Verificar que la publicación existe y pertenece al usuario
        const publicacion = await Publicacion.findOne({
            where: { 
                publicacionId: publicacionId,
                usuarioId: usuarioId,
                estado: true 
            },
            transaction
        })

        if (!publicacion) {
            await transaction.rollback()
            return ResponseHandler.error('Publicación no encontrada o no tienes permisos para eliminarla')
        }

        // Obtener adjuntos por separado
        const adjuntos = await AdjuntoPublicacion.findAll({
            where: { 
                publicacionId: publicacionId,
                estado: true 
            },
            transaction
        })

        // Eliminar archivos de Cloudinary
        if (adjuntos && adjuntos.length > 0) {
            for (const adjunto of adjuntos) {
                try {
                    // Extraer publicId de la URL
                    const urlParts = adjunto.urlAdjunto.split('/')
                    const publicIdWithExtension = urlParts[urlParts.length - 1]
                    const publicId = publicIdWithExtension.split('.')[0]
                    const folder = adjunto.urlAdjunto.includes('imagenes_usuarios') ? 'imagenes_usuarios' : 'videos_usuarios'
                    const fullPublicId = `${folder}/${publicId}`
                    const resourceType = adjunto.urlAdjunto.includes('imagenes_usuarios') ? 'image' : 'video'

                    await deleteFileFromCloudinary(fullPublicId, resourceType)
                    console.log(`Archivo eliminado de Cloudinary: ${fullPublicId}`)
                } catch (deleteError) {
                    console.error(`Error eliminando archivo de Cloudinary:`, deleteError)
                }
            }
        }

        // Eliminar adjuntos de la base de datos (soft delete)
        await AdjuntoPublicacion.update(
            { estado: false },
            { 
                where: { publicacionId: publicacionId },
                transaction 
            }
        )

        // Eliminar publicación (soft delete)
        await Publicacion.update(
            { estado: false },
            { 
                where: { publicacionId: publicacionId },
                transaction 
            }
        )

        await transaction.commit()
        return ResponseHandler.success(null, 'Publicación eliminada exitosamente')

    } catch (error) {
        console.error('Error en deletePublicacion:', error)
        await transaction.rollback()
        throw error
    }
}

module.exports = {
    createPublicacion,
    getPublicacionById,
    getAllPublicaciones,
    deletePublicacion,
}