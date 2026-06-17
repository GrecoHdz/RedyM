/**
 * Configuración de limitadores de tasa para proteger contra ataques DDoS y de fuerza bruta
 */
const { rateLimit } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

/**
 * Limitador estricto para rutas de autenticación
 * - Ventana: 1 hora
 * - Máximo: 6 intentos por hora
 */
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora en milisegundos
  max: 6, // Máximo 6 solicitudes por ventana
  statusCode: 429, // Código de estado HTTP para límite excedido
  standardHeaders: true, // Devuelve los headers estándar de rate limit (X-RateLimit-*)
  legacyHeaders: false, // Deshabilita los headers X-RateLimit-* obsoletos
  message: {
    status: 429,
    message: 'Demasiados intentos de acceso. Por favor, inténtelo de nuevo después de una hora.'
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  // Personalizar la clave para el limitador (por defecto es la IP)
  keyGenerator: (req) => {
    return req.ip; // Usa la IP como identificador
  }
});

/**
 * Limitador para rutas protegidas con JWT
 * - Ventana: 2 minutos
 * - Máximo: 200 solicitudes
 * - Usa el ID de usuario del token JWT para el conteo
 */
const apiLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutos en milisegundos
  max: 200, // Máximo 200 solicitudes por ventana
  statusCode: 429, // Código de estado HTTP para límite excedido
  standardHeaders: true, // Devuelve los headers estándar de rate limit (X-RateLimit-*)
  legacyHeaders: false, // Deshabilita los headers X-RateLimit-* obsoletos
  message: {
    status: 429,
    message: 'Demasiadas solicitudes. Por favor, inténtelo de nuevo después de 2 minutos.'
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  // Personalizar la clave para el limitador usando el ID de usuario del token JWT
  keyGenerator: (req) => {
    // Si el usuario está autenticado (req.user existe), usar su ID
    if (req.user) {
      return `user_${req.user.id_usuario || req.user.id}`;
    }

    // Si no se ha ejecutado el authMiddleware, intentar decodificar el token JWT de forma rápida
    try {
      let token;
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else if (req.cookies && (req.cookies.token || req.cookies.accessToken)) {
        token = req.cookies.token || req.cookies.accessToken;
      }
      if (token) {
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          return `user_${decoded.id}`;
        }
      }
    } catch (e) {
      // Omitir errores de decodificación
    }

    return req.ip; // IP de respaldo
  },
  // No aplicar el límite a las solicitudes que no proveen autenticación (estarán bloqueadas o serán públicas)
  skip: (req) => {
    // Si req.user ya está autenticado, no omitir
    if (req.user) return false;

    // Verificar si hay alguna cabecera de autenticación o cookie para procesar el rate limit
    const authHeader = req.headers['authorization'];
    const hasToken = (authHeader && authHeader.startsWith('Bearer ')) || (req.cookies && (req.cookies.token || req.cookies.accessToken));
    
    return !hasToken; // Omitir si no hay token (para no penalizar endpoints públicos o llamadas no autenticadas que fallarán de todas formas)
  }
});

module.exports = {
  authLimiter,
  apiLimiter
};
