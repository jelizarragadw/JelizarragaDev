// src/models/ProyectoModel.js
const { pool } = require('../config/database');

class ProyectoModel {
    // Obtener todos los proyectos (admin) o los del cliente
    static async findAll(filtros = {}, clienteId = null) {
        let query = `
            SELECT p.*, 
                   c.nombre_completo as cliente_nombre,
                   c.email as cliente_email,
                   (SELECT COUNT(*) FROM planes_pago WHERE proyecto_id = p.id AND estado_cuota = 'pendiente') as cuotas_pendientes,
                   (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE proyecto_id = p.id AND estado_pago = 'completado') as total_pagado
            FROM proyectos p
            JOIN clientes c ON p.cliente_id = c.id
            WHERE 1=1
        `;
        const values = [];

        // Si es cliente, solo sus proyectos
        if (clienteId && filtros.rol === 'cliente') {
            query += ' AND p.cliente_id = ?';
            values.push(clienteId);
        }

        if (filtros.estado) {
            query += ' AND p.estado_proyecto = ?';
            values.push(filtros.estado);
        }

        if (filtros.cliente_id) {
            query += ' AND p.cliente_id = ?';
            values.push(filtros.cliente_id);
        }

        query += ' ORDER BY p.fecha_creacion DESC';

        if (filtros.limite) {
            query += ' LIMIT ?';
            values.push(filtros.limite);
        }

        const [rows] = await pool.query(query, values);
        return rows;
    }

    // Obtener proyecto por ID
    static async findById(id, clienteId = null) {
        let query = `
            SELECT p.*, 
                   c.nombre_completo as cliente_nombre,
                   c.email as cliente_email,
                   c.telefono as cliente_telefono
            FROM proyectos p
            JOIN clientes c ON p.cliente_id = c.id
            WHERE p.id = ?
        `;
        const values = [id];

        if (clienteId) {
            query += ' AND p.cliente_id = ?';
            values.push(clienteId);
        }

        const [rows] = await pool.query(query, values);
        return rows[0];
    }

    // Crear proyecto con sus planes de pago
    static async create(datos, planesPago) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insertar proyecto
            const [result] = await connection.query(
                `INSERT INTO proyectos (
                    cliente_id, nombre_proyecto, descripcion, tipo_proyecto,
                    estado_proyecto, fecha_inicio, fecha_entrega_pactada,
                    costo_total, moneda, incluye_hosting, incluye_dominio, incluye_ssl,
                    notas_internas
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    datos.cliente_id,
                    datos.nombre_proyecto,
                    datos.descripcion || null,
                    datos.tipo_proyecto,
                    datos.estado_proyecto || 'cotizacion',
                    datos.fecha_inicio || new Date(),
                    datos.fecha_entrega_pactada || null,
                    datos.costo_total,
                    datos.moneda || 'EUR',
                    datos.incluye_hosting || false,
                    datos.incluye_dominio || false,
                    datos.incluye_ssl || false,
                    datos.notas_internas || null
                ]
            );

            const proyectoId = result.insertId;

            // Insertar planes de pago
            for (let i = 0; i < planesPago.length; i++) {
                const plan = planesPago[i];
                await connection.query(
                    `INSERT INTO planes_pago (
                        proyecto_id, numero_cuota, nombre_cuota, descripcion,
                        porcentaje, monto, fecha_limite, orden_pago
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        proyectoId,
                        i + 1,
                        plan.nombre_cuota,
                        plan.descripcion || null,
                        plan.porcentaje,
                        plan.monto,
                        plan.fecha_limite,
                        i + 1
                    ]
                );
            }

            // Si incluye hosting, crear suscripción recurrente
            if (datos.incluye_hosting) {
                await connection.query(
                    `INSERT INTO suscripciones_recurrentes (
                        cliente_id, proyecto_id, tipo_servicio, nombre_servicio,
                        ciclo_facturacion, precio_unitario, fecha_inicio,
                        fecha_proxima_facturacion, fecha_expiracion, estado
                    ) VALUES (?, ?, 'hosting', ?, 'anual', ?, ?, DATE_ADD(?, INTERVAL 1 YEAR), DATE_ADD(?, INTERVAL 1 YEAR), 'activo')`,
                    [
                        datos.cliente_id,
                        proyectoId,
                        `Hosting para ${datos.nombre_proyecto}`,
                        datos.costo_hosting || 120,
                        datos.fecha_inicio || new Date(),
                        datos.fecha_inicio || new Date(),
                        datos.fecha_inicio || new Date()
                    ]
                );
            }

            await connection.commit();
            return proyectoId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Actualizar proyecto
    static async update(id, datos) {
        const campos = [];
        const valores = [];

        const camposPermitidos = [
            'nombre_proyecto', 'descripcion', 'estado_proyecto',
            'fecha_entrega_pactada', 'fecha_entrega_real', 'costo_total',
            'horas_trabajadas', 'notas_internas', 'prioridad'
        ];

        for (const campo of camposPermitidos) {
            if (datos[campo] !== undefined) {
                campos.push(`${campo} = ?`);
                valores.push(datos[campo]);
            }
        }

        if (campos.length === 0) return false;

        valores.push(id);
        const [result] = await pool.query(
            `UPDATE proyectos SET ${campos.join(', ')}, fecha_actualizacion = NOW() WHERE id = ?`,
            valores
        );

        return result.affectedRows > 0;
    }

    // Cambiar estado del proyecto
    static async cambiarEstado(id, estado) {
        const [result] = await pool.query(
            'UPDATE proyectos SET estado_proyecto = ?, fecha_actualizacion = NOW() WHERE id = ?',
            [estado, id]
        );
        return result.affectedRows > 0;
    }

    // Obtener resumen financiero del proyecto
    static async getResumenFinanciero(proyectoId) {
        const [rows] = await pool.query(
            `SELECT 
                p.costo_total as presupuesto_total,
                COALESCE((SELECT SUM(monto) FROM pagos WHERE proyecto_id = ? AND estado_pago = 'completado'), 0) as total_pagado,
                COALESCE((SELECT SUM(monto) FROM planes_pago WHERE proyecto_id = ? AND estado_cuota = 'pendiente'), 0) as saldo_pendiente,
                COALESCE((SELECT SUM(monto) FROM cargos_extra WHERE proyecto_id = ? AND estado = 'pendiente'), 0) as cargos_extra
            FROM proyectos p
            WHERE p.id = ?`,
            [proyectoId, proyectoId, proyectoId, proyectoId]
        );
        return rows[0];
    }
}

module.exports = ProyectoModel;