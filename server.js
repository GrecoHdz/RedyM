//Importaciones
const { connectDB } = require("./src/config/database");
const cookieParser = require("cookie-parser");
const express = require("express")
const morgan = require("morgan");
const cors = require("cors");
const app = express();

//Rutas
const usuarioRoutes = require("./src/routes/UsuarioRoute");
const authRoutes = require("./src/routes/authRoute");
const ciudadRoutes = require("./src/routes/CiudadRoute");
const membresiaRoutes = require("./src/routes/MembresiaRoute");
const notificacionesRoutes = require("./src/routes/NotificacionesRoute");
const cuentasRoutes = require("./src/routes/CuentasRoute");
const publicacionRoutes = require("./src/routes/PublicacionRoute");
const interaccionRoutes = require("./src/routes/InteraccionRoute");
const creditoRoutes = require("./src/routes/CreditoRoute");
const configRoutes = require("./src/routes/ConfigRoute");
const redNivelesRoutes = require("./src/routes/redNivelesRoute");
const retiroRoutes = require("./src/routes/RetiroRoute");
const solicitudesUpgradeRoutes = require("./src/routes/solicitudesUpgradeRoute");
const misionRoutes = require("./src/routes/MisionRoute");
const estadisticasRoutes = require("./src/routes/EstadisticasRoute");

// Configurar las asociaciones de los modelos
const setupAssociations = require('./src/models');
setupAssociations();

// Configuración de cookies
const cookieConfig = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // En producción, solo enviar sobre HTTPS
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Para desarrollo local
    partitioned: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: '/',
};
//Middleware para configurar la configuración de cookies en todas las rutas
app.use((req, res, next) => {
    req.cookieConfig = cookieConfig;
    next();
});

// Middlewares
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
console.log("CORS origin:", process.env.FRONTEND_URL);
// Configuración de CORS
const corsOptions = {
    origin: function (origin, callback) {
        // Permitir solicitudes sin origin (Postman, apps móviles)
        if (!origin) {
            return callback(null, true);
        }

        // Limpiar slash final para evitar problemas de concordancia exacta
        const cleanOrigin = origin.replace(/\/$/, "");

        // Lista de orígenes permitidos (los guardamos sin slash final para comparar de forma segura)
        const allowedOrigins = [
            'https://publigana.vercel.app',
            'http://localhost:3000',
            'http://localhost:4000',
        ];

        if (process.env.FRONTEND_URL) {
            allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
        }

        // Permitir todas las URLs de Vercel de tu proyecto
        const isVercelPreview = cleanOrigin.includes('miseguros-projects-00c1e523.vercel.app');

        const isAllowed = allowedOrigins.includes(cleanOrigin) || isVercelPreview;

        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error(`No permitido por CORS. Recibido: ${origin}`));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'Pragma', 'X-Refresh-Token'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));

// Importar limitadores de tasa
const { authLimiter, apiLimiter } = require("./src/middlewares/rateLimiters");

// Importar Rutas e integrar limitadores
app.use("/auth", authLimiter, authRoutes);
app.use("/usuarios", apiLimiter, usuarioRoutes);
app.use("/ciudad", apiLimiter, ciudadRoutes);
app.use("/membresia", apiLimiter, membresiaRoutes);
app.use("/notificaciones", apiLimiter, notificacionesRoutes);
app.use("/cuentas", apiLimiter, cuentasRoutes);
app.use("/publicaciones", apiLimiter, publicacionRoutes);
app.use("/interacciones", apiLimiter, interaccionRoutes);
app.use("/credito", apiLimiter, creditoRoutes);
app.use("/config", apiLimiter, configRoutes);
app.use("/red", apiLimiter, redNivelesRoutes);
app.use("/retiros", apiLimiter, retiroRoutes);
app.use("/red-solicitudes", apiLimiter, solicitudesUpgradeRoutes);
app.use("/misiones", apiLimiter, misionRoutes);
app.use("/estadisticas", apiLimiter, estadisticasRoutes);

// Iniciar servidor
const PORT = process.env.PORT || 4000;
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

startServer();