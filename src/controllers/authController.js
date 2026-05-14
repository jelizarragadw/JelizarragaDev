// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

class AuthController {
    // Login de cliente REAL
    static async loginCliente(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email y contraseña son requeridos'
                });
            }

            // Verificar intentos fallidos
            const [bloqueoCheck] = await pool.query(
                'SELECT bloqueado_hasta FROM usuario_acceso WHERE email = ?',
                [email]
            );

            if (bloqueoCheck[0] && bloqueoCheck[0].bloqueado_hasta) {
                const bloqueadoHasta = new Date(bloqueoCheck[0].bloqueado_hasta);
                if (bloqueadoHasta > new Date()) {
                    return res.status(401).json({
                        success: false,
                        message: `Demasiados intentos fallidos. Cuenta bloqueada hasta ${bloqueadoHasta.toLocaleString()}`
                    });
                }
            }

            // Buscar cliente con sus credenciales
            const [rows] = await pool.query(
                `SELECT c.id, c.nombre_completo, c.email, c.estado_cliente, 
                        ua.password_hash, ua.intentos_fallidos, ua.bloqueado_hasta
                 FROM clientes c
                 JOIN usuario_acceso ua ON c.id = ua.cliente_id
                 WHERE c.email = ?`,
                [email]
            );

            if (rows.length === 0) {
                // Registrar intento fallido
                await pool.query(
                    'UPDATE usuario_acceso SET intentos_fallidos = intentos_fallidos + 1 WHERE email = ?',
                    [email]
                );
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            const cliente = rows[0];

            // Verificar estado del cliente
            if (cliente.estado_cliente === 'bloqueado') {
                return res.status(401).json({
                    success: false,
                    message: 'Cuenta bloqueada. Contacte al administrador.'
                });
            }

            if (cliente.estado_cliente === 'inactivo') {
                return res.status(401).json({
                    success: false,
                    message: 'Cuenta inactiva. Contacte al administrador.'
                });
            }

            // Verificar contraseña
            const passwordValida = await bcrypt.compare(password, cliente.password_hash);

            if (!passwordValida) {
                // Incrementar intentos fallidos
                await pool.query(
                    'UPDATE usuario_acceso SET intentos_fallidos = intentos_fallidos + 1 WHERE email = ?',
                    [email]
                );

                // Bloquear después de 5 intentos
                const [intentos] = await pool.query(
                    'SELECT intentos_fallidos FROM usuario_acceso WHERE email = ?',
                    [email]
                );

                if (intentos[0].intentos_fallidos >= 5) {
                    await pool.query(
                        'UPDATE usuario_acceso SET bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE email = ?',
                        [email]
                    );
                    return res.status(401).json({
                        success: false,
                        message: 'Demasiados intentos fallidos. Cuenta bloqueada por 30 minutos.'
                    });
                }

                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Resetear intentos fallidos
            await pool.query(
                'UPDATE usuario_acceso SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE cliente_id = ?',
                [cliente.id]
            );

            await pool.query(
                'UPDATE clientes SET ultimo_acceso = NOW() WHERE id = ?',
                [cliente.id]
            );

            // Registrar login en log
            await pool.query(
                `INSERT INTO logs_actividad_clientes (cliente_id, accion, ip_address, user_agent)
                 VALUES (?, 'login', ?, ?)`,
                [cliente.id, req.ip || req.connection.remoteAddress, req.headers['user-agent']]
            );

            // Generar token JWT
            const token = jwt.sign(
                {
                    id: cliente.id,
                    email: cliente.email,
                    nombre: cliente.nombre_completo,
                    rol: 'cliente'
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            res.json({
                success: true,
                message: 'Login exitoso',
                data: {
                    token,
                    usuario: {
                        id: cliente.id,
                        nombre: cliente.nombre_completo,
                        email: cliente.email,
                        rol: 'cliente'
                    }
                }
            });
        } catch (error) {
            console.error('Error en login cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error en el servidor'
            });
        }
    }

    // Login de usuario del sistema REAL
    static async loginSistema(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email y contraseña son requeridos'
                });
            }

            const [rows] = await pool.query(
                'SELECT * FROM usuarios_sistema WHERE email = ?',
                [email]
            );

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            const usuario = rows[0];

            if (!usuario.activo) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario inactivo. Contacte al administrador.'
                });
            }

            const passwordValida = await bcrypt.compare(password, usuario.password_hash);

            if (!passwordValida) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            await pool.query(
                'UPDATE usuarios_sistema SET ultimo_login = NOW() WHERE id = ?',
                [usuario.id]
            );

            const token = jwt.sign(
                {
                    id: usuario.id,
                    email: usuario.email,
                    nombre: usuario.nombre_usuario,
                    rol: usuario.rol,
                    permisos: usuario.permisos
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            res.json({
                success: true,
                message: 'Login exitoso',
                data: {
                    token,
                    usuario: {
                        id: usuario.id,
                        nombre: usuario.nombre_usuario,
                        email: usuario.email,
                        rol: usuario.rol
                    }
                }
            });
        } catch (error) {
            console.error('Error en login sistema:', error);
            res.status(500).json({
                success: false,
                message: 'Error en el servidor'
            });
        }
    }

    // Registrar nuevo cliente REAL
    static async registrarCliente(req, res) {
        try {
            const { nombre_completo, email, password, telefono, direccion, ciudad, empresa, como_conocio } = req.body;

            // Validaciones
            if (!nombre_completo || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Nombre, email y contraseña son requeridos'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'La contraseña debe tener al menos 6 caracteres'
                });
            }

            // Verificar email único
            const [existe] = await pool.query(
                'SELECT id FROM clientes WHERE email = ?',
                [email]
            );

            if (existe.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un cliente con este email'
                });
            }

            const connection = await pool.getConnection();
            await connection.beginTransaction();

            try {
                // Insertar cliente
                const [result] = await connection.query(
                    `INSERT INTO clientes (uuid, nombre_completo, email, telefono, direccion, ciudad, empresa, como_conocio)
                     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
                    [nombre_completo, email, telefono || null, direccion || null, ciudad || null, empresa || null, como_conocio || 'otro']
                );

                const clienteId = result.insertId;

                // Insertar acceso
                const hashedPassword = await bcrypt.hash(password, 10);
                await connection.query(
                    `INSERT INTO usuario_acceso (cliente_id, email, password_hash)
                     VALUES (?, ?, ?)`,
                    [clienteId, email, hashedPassword]
                );

                // Insertar preferencias por defecto
                await connection.query(
                    `INSERT INTO preferencias_alertas_clientes (cliente_id)
                     VALUES (?)`,
                    [clienteId]
                );

                await connection.commit();

                res.status(201).json({
                    success: true,
                    message: 'Cliente registrado exitosamente',
                    data: { clienteId }
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error en registro:', error);
            res.status(500).json({
                success: false,
                message: 'Error en el servidor'
            });
        }
    }

    // Obtener perfil REAL
    static async getPerfil(req, res) {
        try {
            if (req.user.rol === 'cliente') {
                const [rows] = await pool.query(
                    `SELECT c.id, c.uuid, c.codigo_cliente, c.nombre_completo, c.email, c.telefono, 
                            c.direccion, c.ciudad, c.pais, c.empresa, c.estado_cliente, c.fecha_registro,
                            ua.ultimo_acceso as ultimo_login
                     FROM clientes c
                     LEFT JOIN usuario_acceso ua ON c.id = ua.cliente_id
                     WHERE c.id = ?`,
                    [req.user.id]
                );

                if (rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Cliente no encontrado'
                    });
                }

                res.json({
                    success: true,
                    data: rows[0]
                });
            } else {
                const [rows] = await pool.query(
                    `SELECT id, nombre_usuario, email, rol, permisos, activo, ultimo_login, fecha_registro
                     FROM usuarios_sistema
                     WHERE id = ?`,
                    [req.user.id]
                );

                res.json({
                    success: true,
                    data: rows[0]
                });
            }
        } catch (error) {
            console.error('Error en perfil:', error);
            res.status(500).json({
                success: false,
                message: 'Error en el servidor'
            });
        }
    }

    // Cambiar password REAL
    static async cambiarPassword(req, res) {
        try {
            const { password_actual, password_nueva } = req.body;

            if (!password_actual || !password_nueva) {
                return res.status(400).json({
                    success: false,
                    message: 'Contraseña actual y nueva son requeridas'
                });
            }

            if (password_nueva.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'La nueva contraseña debe tener al menos 6 caracteres'
                });
            }

            let passwordActualValida = false;

            if (req.user.rol === 'cliente') {
                const [rows] = await pool.query(
                    'SELECT password_hash FROM usuario_acceso WHERE cliente_id = ?',
                    [req.user.id]
                );

                if (rows.length > 0) {
                    passwordActualValida = await bcrypt.compare(password_actual, rows[0].password_hash);
                }

                if (!passwordActualValida) {
                    return res.status(401).json({
                        success: false,
                        message: 'Contraseña actual incorrecta'
                    });
                }

                const hashedPassword = await bcrypt.hash(password_nueva, 10);
                await pool.query(
                    'UPDATE usuario_acceso SET password_hash = ?, ultimo_cambio_password = NOW() WHERE cliente_id = ?',
                    [hashedPassword, req.user.id]
                );
            } else {
                const [rows] = await pool.query(
                    'SELECT password_hash FROM usuarios_sistema WHERE id = ?',
                    [req.user.id]
                );

                if (rows.length > 0) {
                    passwordActualValida = await bcrypt.compare(password_actual, rows[0].password_hash);
                }

                if (!passwordActualValida) {
                    return res.status(401).json({
                        success: false,
                        message: 'Contraseña actual incorrecta'
                    });
                }

                const hashedPassword = await bcrypt.hash(password_nueva, 10);
                await pool.query(
                    'UPDATE usuarios_sistema SET password_hash = ? WHERE id = ?',
                    [hashedPassword, req.user.id]
                );
            }

            res.json({
                success: true,
                message: 'Contraseña actualizada exitosamente'
            });
        } catch (error) {
            console.error('Error al cambiar password:', error);
            res.status(500).json({
                success: false,
                message: 'Error en el servidor'
            });
        }
    }

    // Cerrar sesión (opcional, para invalidar token en cliente)
    static async logout(req, res) {
        try {
            // Registrar logout en log
            if (req.user.rol === 'cliente') {
                await pool.query(
                    `INSERT INTO logs_actividad_clientes (cliente_id, accion, ip_address, user_agent)
                     VALUES (?, 'logout', ?, ?)`,
                    [req.user.id, req.ip || req.connection.remoteAddress, req.headers['user-agent']]
                );
            }

            res.json({
                success: true,
                message: 'Sesión cerrada exitosamente'
            });
        } catch (error) {
            console.error('Error en logout:', error);
            res.status(500).json({
                success: false,
                message: 'Error en el servidor'
            });
        }
    }
}

module.exports = AuthController;