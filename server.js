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
        if (!origin) return callback(null, true);

        // Lista de orígenes permitidos
        const allowedOrigins = [
            'https://front-six-lemon.vercel.app',  // URL principal
            'http://localhost:5173',
            'http://localhost:3000',
            process.env.FRONTEND_URL
        ];

        // Permitir todas las URLs de Vercel de tu proyecto
        const isVercelPreview = origin && origin.includes('miseguros-projects-00c1e523.vercel.app');

        if (allowedOrigins.includes(origin) || isVercelPreview) {
            callback(null, true);
        } else {
            console.log('❌ Origen bloqueado por CORS:', origin);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'Pragma'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));

// Importar Rutas  
app.use("/auth", authRoutes);
app.use("/usuarios", usuarioRoutes);
app.use("/ciudad", ciudadRoutes);

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