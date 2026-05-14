// src/models/ClienteModel.js
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class ClienteModel {
    // Obtener todos los clientes (admin)
    static async findAll(filtros = {}) {
        let query = `
            SELECT c.*, 
                   (SELECT COUNT(*) FROM proyectos WHERE cliente_id = c.id) as total_proyectos,
                   (SELECT SUM(monto) FROM pagos WHERE cliente_id = c.id AND estado_pago = 'completado') as total_gastado
            FROM clientes c
            WHERE 1=1
        `;
        const values = [];

        if (filtros.estado) {
            query += ' AND c.estado_cliente = ?';
            values.push(filtros.estado);
        }

        if (filtros.busqueda) {
            query += ' AND (c.nombre_completo LIKE ? OR c.email LIKE ? OR c.documento LIKE ?)';
            const search = `%${filtros.busqueda}%`;
            values.push(search, search, search);
        }

        query += ' ORDER BY c.fecha_registro DESC LIMIT ? OFFSET ?';
        values.push(filtros.limite || 50, filtros.offset || 0);

        const [rows] = await pool.query(query, values);
        return rows;
    }

    // Obtener cliente por ID
    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT c.*, 
                    ua.ultimo_acceso as ultimo_login,
                    ua.two_factor_habilitado
             FROM clientes c
             LEFT JOIN usuario_acceso ua ON c.id = ua.cliente_id
             WHERE c.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Obtener cliente por email (para login)
    static async findByEmail(email) {
        const [rows] = await pool.query(
            `SELECT c.*, ua.password_hash, ua.intentos_fallidos, ua.bloqueado_hasta
             FROM clientes c
             JOIN usuario_acceso ua ON c.id = ua.cliente_id
             WHERE c.email = ?`,
            [email]
        );
        return rows[0];
    }

    // Crear nuevo cliente
    static async create(clienteData, password) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insertar cliente
            const [result] = await connection.query(
                `INSERT INTO clientes (uuid, nombre_completo, email, telefono, direccion, ciudad, empresa, como_conocio)
                 VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
                [
                    clienteData.nombre_completo,
                    clienteData.email,
                    clienteData.telefono || null,
                    clienteData.direccion || null,
                    clienteData.ciudad || null,
                    clienteData.empresa || null,
                    clienteData.como_conocio || 'otro'
                ]
            );

            const clienteId = result.insertId;

            // Insertar acceso
            const hashedPassword = await bcrypt.hash(password, 10);
            await connection.query(
                `INSERT INTO usuario_acceso (cliente_id, email, password_hash)
                 VALUES (?, ?, ?)`,
                [clienteId, clienteData.email, hashedPassword]
            );

            // Insertar preferencias por defecto
            await connection.query(
                `INSERT INTO preferencias_alertas_clientes (cliente_id)
                 VALUES (?)`,
                [clienteId]
            );

            await connection.commit();
            return clienteId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Actualizar cliente
    static async update(id, datos) {
        const campos = [];
        const valores = [];

        const camposPermitidos = ['nombre_completo', 'telefono', 'direccion', 'ciudad', 'empresa', 'estado_cliente', 'notas'];

        for (const campo of camposPermitidos) {
            if (datos[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(datos[campo]);
            }
        }

        if (campos.length === 0) return false;

        valores.push(id);
        const [result] = await pool.query(
            `UPDATE clientes SET ${campos.join(', ')}, fecha_actualizacion = NOW() WHERE id = ?`,
            valores
        );

        return result.affectedRows > 0;
    }

    // Cambiar contraseña
    static async cambiarPassword(clienteId, nuevaPassword) {
        const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
        const [result] = await pool.query(
            `UPDATE usuario_acceso 
             SET password_hash = ?, ultimo_cambio_password = NOW()
             WHERE cliente_id = ?`,
            [hashedPassword, clienteId]
        );
        return result.affectedRows > 0;
    }

    // Registrar intento de login fallido
    static async registrarIntentoFallido(email) {
        await pool.query(
            `UPDATE usuario_acceso 
             SET intentos_fallidos = intentos_fallidos + 1,
                 bloqueado_hasta = CASE 
                     WHEN intentos_fallidos >= 4 THEN DATE_ADD(NOW(), INTERVAL 30 MINUTE)
                     ELSE bloqueado_hasta
                 END
             WHERE email = ?`,
            [email]
        );
    }

    // Resetear intentos fallidos
    static async resetearIntentos(email) {
        await pool.query(
            `UPDATE usuario_acceso 
             SET intentos_fallidos = 0, bloqueado_hasta = NULL
             WHERE email = ?`,
            [email]
        );
    }

    // Verificar si cliente está bloqueado
    static async estaBloqueado(email) {
        const [rows] = await pool.query(
            `SELECT bloqueado_hasta FROM usuario_acceso WHERE email = ?`,
            [email]
        );

        if (rows[0] && rows[0].bloqueado_hasta) {
            return new Date(rows[0].bloqueado_hasta) > new Date();
        }
        return false;
    }

    // Obtener resumen del cliente (dashboard)
    static async getResumen(clienteId) {
        const [rows] = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM proyectos WHERE cliente_id = ? AND estado_proyecto IN ('en_desarrollo', 'revision')) as proyectos_activos,
                (SELECT COUNT(*) FROM proyectos WHERE cliente_id = ? AND estado_proyecto = 'entregado') as proyectos_completados,
                (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE cliente_id = ? AND estado_pago = 'completado') as total_pagado,
                (SELECT COALESCE(SUM(pp.monto), 0) FROM planes_pago pp 
                 JOIN proyectos p ON pp.proyecto_id = p.id 
                 WHERE p.cliente_id = ? AND pp.estado_cuota = 'pendiente') as deuda_pendiente,
                (SELECT COUNT(*) FROM notificaciones WHERE usuario_id = ? AND leido = FALSE) as notificaciones_no_leidas,
                (SELECT COUNT(*) FROM tickets_soporte WHERE cliente_id = ? AND estado != 'cerrado') as tickets_activos
            `,
            [clienteId, clienteId, clienteId, clienteId, clienteId, clienteId]
        );
        return rows[0];
    }
}

module.exports = ClienteModel;