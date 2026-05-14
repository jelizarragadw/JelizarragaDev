// src/models/TicketModel.js
const { pool } = require('../config/database');

class TicketModel {
    // Obtener todos los tickets (admin) o del cliente
    static async findAll(filtros = {}, clienteId = null) {
        let query = `
            SELECT t.*, 
                   c.nombre_completo as cliente_nombre,
                   c.email as cliente_email,
                   p.nombre_proyecto,
                   (SELECT COUNT(*) FROM respuestas_tickets WHERE ticket_id = t.id) as total_respuestas
            FROM tickets_soporte t
            JOIN clientes c ON t.cliente_id = c.id
            LEFT JOIN proyectos p ON t.proyecto_id = p.id
            WHERE 1=1
        `;
        const values = [];

        // Si es cliente, solo sus tickets
        if (clienteId) {
            query += ' AND t.cliente_id = ?';
            values.push(clienteId);
        }

        if (filtros.estado) {
            query += ' AND t.estado = ?';
            values.push(filtros.estado);
        }

        if (filtros.prioridad) {
            query += ' AND t.prioridad = ?';
            values.push(filtros.prioridad);
        }

        query += ' ORDER BY t.fecha_creacion DESC';

        const [rows] = await pool.query(query, values);
        return rows;
    }

    // Obtener ticket por ID
    static async findById(id, clienteId = null) {
        let query = `
            SELECT t.*, 
                   c.nombre_completo as cliente_nombre,
                   c.email as cliente_email,
                   c.telefono as cliente_telefono,
                   p.nombre_proyecto
            FROM tickets_soporte t
            JOIN clientes c ON t.cliente_id = c.id
            LEFT JOIN proyectos p ON t.proyecto_id = p.id
            WHERE t.id = ?
        `;
        const values = [id];

        if (clienteId) {
            query += ' AND t.cliente_id = ?';
            values.push(clienteId);
        }

        const [rows] = await pool.query(query, values);
        return rows[0];
    }

    // Obtener respuestas de un ticket
    static async getRespuestas(ticketId) {
        const [rows] = await pool.query(
            `SELECT r.*,
                    CASE 
                        WHEN r.usuario_sistema_id IS NOT NULL THEN u.nombre_usuario
                        ELSE c.nombre_completo
                    END as autor_nombre,
                    CASE 
                        WHEN r.usuario_sistema_id IS NOT NULL THEN 'admin'
                        ELSE 'cliente'
                    END as autor_tipo,
                    r.fecha_respuesta
             FROM respuestas_tickets r
             LEFT JOIN usuarios_sistema u ON r.usuario_sistema_id = u.id
             LEFT JOIN clientes c ON r.cliente_id = c.id
             WHERE r.ticket_id = ?
             ORDER BY r.fecha_respuesta ASC`,
            [ticketId]
        );
        return rows;
    }

    // Crear nuevo ticket
    static async create(datos) {
        const [result] = await pool.query(
            `INSERT INTO tickets_soporte (
                cliente_id, proyecto_id, asunto, descripcion, 
                prioridad, categoria
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                datos.cliente_id,
                datos.proyecto_id || null,
                datos.asunto,
                datos.descripcion,
                datos.prioridad || 'media',
                datos.categoria || 'consulta'
            ]
        );

        return result.insertId;
    }

    // Agregar respuesta
    static async addRespuesta(ticketId, datos) {
        const [result] = await pool.query(
            `INSERT INTO respuestas_tickets (
                ticket_id, usuario_sistema_id, cliente_id, mensaje, archivo_adjunto
            ) VALUES (?, ?, ?, ?, ?)`,
            [
                ticketId,
                datos.usuario_sistema_id || null,
                datos.cliente_id || null,
                datos.mensaje,
                datos.archivo_adjunto || null
            ]
        );

        // Actualizar estado del ticket si es respuesta de admin
        if (datos.usuario_sistema_id) {
            await pool.query(
                `UPDATE tickets_soporte 
                 SET estado = 'en_proceso', 
                     fecha_actualizacion = NOW()
                 WHERE id = ?`,
                [ticketId]
            );
        } else {
            // Si cliente responde, cambiar a esperando_admin
            await pool.query(
                `UPDATE tickets_soporte 
                 SET estado = 'esperando_cliente', 
                     fecha_actualizacion = NOW()
                 WHERE id = ?`,
                [ticketId]
            );
        }

        return result.insertId;
    }

    // Actualizar estado del ticket
    static async updateEstado(ticketId, estado, usuarioSistemaId = null) {
        const [result] = await pool.query(
            `UPDATE tickets_soporte 
             SET estado = ?, 
                 fecha_actualizacion = NOW(),
                 fecha_cierre = CASE WHEN ? = 'cerrado' THEN NOW() ELSE fecha_cierre END
             WHERE id = ?`,
            [estado, estado, ticketId]
        );

        return result.affectedRows > 0;
    }

    // Cambiar prioridad (solo admin)
    static async updatePrioridad(ticketId, prioridad) {
        const [result] = await pool.query(
            `UPDATE tickets_soporte 
             SET prioridad = ?, fecha_actualizacion = NOW()
             WHERE id = ?`,
            [prioridad, ticketId]
        );
        return result.affectedRows > 0;
    }

    // Estadísticas de tickets por cliente
    static async getEstadisticas(clienteId) {
        const [rows] = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN estado = 'abierto' THEN 1 ELSE 0 END) as abiertos,
                SUM(CASE WHEN estado = 'en_proceso' THEN 1 ELSE 0 END) as en_proceso,
                SUM(CASE WHEN estado = 'esperando_cliente' THEN 1 ELSE 0 END) as esperando_cliente,
                SUM(CASE WHEN estado = 'resuelto' THEN 1 ELSE 0 END) as resueltos,
                SUM(CASE WHEN estado = 'cerrado' THEN 1 ELSE 0 END) as cerrados
            FROM tickets_soporte
            WHERE cliente_id = ?`,
            [clienteId]
        );
        return rows[0];
    }

    // Estadísticas generales (admin)
    static async getEstadisticasGenerales() {
        const [rows] = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN estado = 'abierto' THEN 1 ELSE 0 END) as abiertos,
                SUM(CASE WHEN estado = 'en_proceso' THEN 1 ELSE 0 END) as en_proceso,
                SUM(CASE WHEN prioridad = 'alta' AND estado NOT IN ('resuelto', 'cerrado') THEN 1 ELSE 0 END) as urgentes,
                AVG(CASE WHEN estado = 'resuelto' THEN TIMESTAMPDIFF(HOUR, fecha_creacion, fecha_cierre) ELSE NULL END) as tiempo_promedio_horas
            FROM tickets_soporte`
        );
        return rows[0];
    }
}

module.exports = TicketModel;