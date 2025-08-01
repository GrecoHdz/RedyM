const jwt = require("jsonwebtoken");

const generateToken = (usuarioId) => {
    const expiresIn = 60 * 60 * 24; // 24 horas en segundos
    
    try {
        const token = jwt.sign(
            {
                usuarioId: usuarioId
            },
            process.env.JWT_SECRET,
            {
                expiresIn: expiresIn
            }
        );
        
        return {
            token,
            expiresIn
        };
    } catch (error) {
        console.error('Error generating token:', error);
        throw new Error('Error al generar el token');
    }
};

const tokenVerificationError = {
    "invalid signature": "La firma del token es inválida",
    "jwt expired": "El token ha expirado",
    "invalid token": "Token no válido",
    "JsonWebTokenError": "Token malformado",
    "TokenExpiredError": "Token expirado",
    "NotBeforeError": "Token no activo aún",
    "No Bearer": "Utiliza formato Bearer"
};

module.exports = {
    generateToken,
    tokenVerificationError
};