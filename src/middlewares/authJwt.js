const jwt = require("jsonwebtoken");
const db = require("../models");
const Usuario = db.Usuario;
const { tokenVerificationError } = require("../utils/tokenManager");

const verifyToken = async (req, res, next) => {
    try {
        let token = null;

        // 1. Buscar token en header Authorization
        if (req.headers.authorization) {
            const authHeader = req.headers.authorization;
            
            // Verificar formato Bearer
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7); // Remover 'Bearer '
            } else {
                return res.status(401).json({
                    error: "Token debe usar formato Bearer"
                });
            }
        }
        
        // 2. Si no hay token en header, buscar en cookies
        if (!token && req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        // 3. Si no hay token en ningún lugar
        if (!token) {
            return res.status(401).json({
                error: "Token de acceso requerido"
            });
        }

        // 4. Verificar que JWT_SECRET exista
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET no está definido en las variables de entorno');
            return res.status(500).json({
                error: "Error de configuración del servidor"
            });
        }

        // 5. Verificar y decodificar el token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            console.error('JWT Error:', jwtError.message);
            
            const errorMessage = tokenVerificationError[jwtError.message] || 
                               tokenVerificationError[jwtError.name] || 
                               "Token inválido";
            
            return res.status(401).json({
                error: errorMessage
            });
        }

        // 6. Verificar que el token tenga usuarioId
        if (!decoded.usuarioId) {
            return res.status(401).json({
                error: "Token no contiene información de usuario válida"
            });
        }

        // 7. Buscar el usuario en la base de datos
        const usuario = await Usuario.findOne({
            where: {
                usuarioId: decoded.usuarioId,
                estado: true // Solo usuarios activos
            }
        });

        if (!usuario) {
            return res.status(401).json({
                error: "Usuario no encontrado o inactivo"
            });
        }

        // 8. Agregar información del usuario al request
        req.usuarioId = decoded.usuarioId;
        req.usuario = usuario;

        // 9. Continuar con el siguiente middleware
        next();

    } catch (error) {
        console.error('Error en verifyToken middleware:', error);
        return res.status(500).json({
            error: "Error interno del servidor"
        });
    }
};

module.exports = verifyToken;