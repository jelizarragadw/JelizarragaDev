// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Acceso denegado. No se proporcionó token'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.rol === 'cliente') {
            const [rows] = await pool.query(
                'SELECT c.* FROM clientes c JOIN usuario_acceso ua ON c.id = ua.cliente_id WHERE c.id = ? AND c.estado_cliente = "activo"',
                [decoded.id]
            );

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no encontrado o inactivo'
                });
            }

            req.user = {
                id: rows[0].id,
                email: rows[0].email,
                nombre: rows[0].nombre_completo,
                rol: 'cliente'
            };
        } else {
            const [rows] = await pool.query(
                'SELECT * FROM usuarios_sistema WHERE id = ? AND activo = TRUE',
                [decoded.id]
            );

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario del sistema no encontrado'
                });
            }

            req.user = {
                id: rows[0].id,
                email: rows[0].email,
                nombre: rows[0].nombre_usuario,
                rol: rows[0].rol,
                permisos: rows[0].permisos
            };
        }

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado'
            });
        }

        console.error('Auth error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error de autenticación'
        });
    }
};

const verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No autenticado'
            });
        }

        if (!rolesPermitidos.includes(req.user.rol)) {
            return res.status(403).json({
                success: false,
                message: 'Acceso denegado. No tienes los permisos necesarios'
            });
        }

        next();
    };
};

const verificarPropiedadCliente = (paramName = 'id') => {
    return async (req, res, next) => {
        if (req.user.rol !== 'cliente') {
            return next();
        }

        const recursoId = req.params[paramName];

        if (!recursoId) {
            return next();
        }

        let pertenece = false;

        // Verificar proyectos
        const [proyectos] = await pool.query(
            'SELECT cliente_id FROM proyectos WHERE id = ?',
            [recursoId]
        );

        if (proyectos.length > 0 && proyectos[0].cliente_id === req.user.id) {
            pertenece = true;
        }

        // Verificar pagos
        const [pagos] = await pool.query(
            'SELECT cliente_id FROM pagos WHERE id = ?',
            [recursoId]
        );

        if (pagos.length > 0 && pagos[0].cliente_id === req.user.id) {
            pertenece = true;
        }

        if (!pertenece) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para acceder a este recurso'
            });
        }

        next();
    };
};

module.exports = {
    authMiddleware,
    verificarRol,
    verificarPropiedadCliente
};