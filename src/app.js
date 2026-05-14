// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const proyectoRoutes = require('./routes/proyectoRoutes');
const pagoRoutes = require('./routes/pagoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const suscripcionRoutes = require('./routes/suscripcionRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

const { testConnection } = require('./config/database');

const app = express();

// Conectar a base de datos
testConnection();

// ==============================================
// CONFIGURACIÓN CORS CORREGIDA
// ==============================================
const allowedOrigins = [
    'http://localhost:5173',   // Vite
    'http://localhost:3000',   // Frontend serve
    'http://localhost:5500',   // Live Server VS Code
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir peticiones sin origen (como Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Origen bloqueado por CORS:', origin);
            callback(null, true); // En desarrollo permitimos todos
            // callback(new Error('No permitido por CORS')); // En producción descomentar
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Authorization']
};

// Aplicar CORS antes que cualquier otro middleware
app.use(cors(corsOptions));

// Middlewares
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Demasiadas solicitudes desde esta IP'
});
app.use('/api/', limiter);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/proyectos', proyectoRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/suscripciones', suscripcionRoutes);
app.use('/api/tickets', ticketRoutes);

// Ruta de health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        cors_origins: allowedOrigins
    });
});

// Middleware para manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error interno del servidor'
    });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.originalUrl}`
    });
});

module.exports = app;