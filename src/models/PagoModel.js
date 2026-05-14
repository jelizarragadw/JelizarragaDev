// src/models/PagoModel.js
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class PagoModel {
    // Crear registro de pago (estado: iniciado)
    static async crearPago(clienteId, proyectoId, planPagoId, monto, metodoPago) {
        const uuid = uuidv4();

        const [result] = await pool.query(
            `INSERT INTO pagos (cliente_id, proyecto_id, plan_pago_id, uuid_transaccion, monto, metodo_pago, estado_pago)
             VALUES (?, ?, ?, ?, ?, ?, 'iniciado')`,
            [clienteId, proyectoId, planPagoId, uuid, monto, metodoPago]
        );

        return {
            id: result.insertId,
            uuid_transaccion: uuid
        };
    }

    // Actualizar estado del pago
    static async actualizarEstado(pagoId, estado, datosAdicionales = {}) {
        const updates = ['estado_pago = ?'];
        const values = [estado];

        if (datosAdicionales.fecha_pago) {
            updates.push('fecha_pago = ?');
            values.push(datosAdicionales.fecha_pago);
        }

        if (datosAdicionales.comprobante_url) {
            updates.push('comprobante_url = ?');
            values.push(datosAdicionales.comprobante_url);
        }

        if (datosAdicionales.notas_pago) {
            updates.push('notas_pago = ?');
            values.push(datosAdicionales.notas_pago);
        }

        values.push(pagoId);

        const [result] = await pool.query(
            `UPDATE pagos SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Guardar transacción de PayPal
    static async guardarTransaccionPaypal(pagoId, datosPaypal) {
        const [result] = await pool.query(
            `INSERT INTO transacciones_paypal (
                pago_id, paypal_order_id, paypal_payer_id, paypal_payment_id,
                paypal_transaction_id, paypal_status, payer_email, payer_name,
                paypal_fee, net_amount, currency_code, capture_id,
                capture_status, capture_date, raw_response
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                pagoId,
                datosPaypal.paypal_order_id,
                datosPaypal.paypal_payer_id,
                datosPaypal.paypal_payment_id,
                datosPaypal.paypal_transaction_id,
                datosPaypal.paypal_status,
                datosPaypal.payer_email,
                datosPaypal.payer_name,
                datosPaypal.paypal_fee || 0,
                datosPaypal.net_amount,
                datosPaypal.currency_code,
                datosPaypal.capture_id,
                datosPaypal.capture_status,
                datosPaypal.capture_date,
                JSON.stringify(datosPaypal.raw_response)
            ]
        );

        return result.insertId;
    }

    // Obtener pago por ID
    static async obtenerPago(pagoId, clienteId = null) {
        let query = `
            SELECT p.*, 
                   pr.nombre_proyecto,
                   pp.nombre_cuota
            FROM pagos p
            LEFT JOIN proyectos pr ON p.proyecto_id = pr.id
            LEFT JOIN planes_pago pp ON p.plan_pago_id = pp.id
            WHERE p.id = ?
        `;
        const values = [pagoId];

        if (clienteId) {
            query += ' AND p.cliente_id = ?';
            values.push(clienteId);
        }

        const [rows] = await pool.query(query, values);

        if (rows.length > 0) {
            // Obtener transacción de PayPal si existe
            const [paypal] = await pool.query(
                'SELECT * FROM transacciones_paypal WHERE pago_id = ?',
                [pagoId]
            );
            rows[0].transaccion_paypal = paypal[0] || null;
        }

        return rows[0];
    }

    // Obtener pagos de un cliente
    static async obtenerPagosCliente(clienteId, limite = 20) {
        const [rows] = await pool.query(
            `SELECT p.*, pr.nombre_proyecto
             FROM pagos p
             LEFT JOIN proyectos pr ON p.proyecto_id = pr.id
             WHERE p.cliente_id = ?
             ORDER BY p.fecha_registro DESC
             LIMIT ?`,
            [clienteId, limite]
        );
        return rows;
    }

    // Verificar si un plan de pago ya tiene un pago iniciado/completado
    static async verificarPagoExistente(planPagoId) {
        const [rows] = await pool.query(
            `SELECT id, estado_pago FROM pagos 
             WHERE plan_pago_id = ? AND estado_pago IN ('iniciado', 'completado', 'pendiente_verificacion')
             LIMIT 1`,
            [planPagoId]
        );
        return rows[0];
    }
}

module.exports = PagoModel;