// src/controllers/suscripcionController.js
const { pool } = require('../config/database');
const PagoModel = require('../models/PagoModel');

class SuscripcionController {
    // Listar suscripciones del cliente
    static async listar(req, res) {
        try {
            const clienteId = req.user.id;

            const [suscripciones] = await pool.query(
                `SELECT s.*, 
                        DATEDIFF(s.fecha_expiracion, CURDATE()) AS dias_restantes,
                        CASE 
                            WHEN DATEDIFF(s.fecha_expiracion, CURDATE()) <= 0 THEN 'expirado'
                            WHEN DATEDIFF(s.fecha_expiracion, CURDATE()) <= 7 THEN 'critico'
                            WHEN DATEDIFF(s.fecha_expiracion, CURDATE()) <= 30 THEN 'proximo'
                            ELSE 'vigente'
                        END AS estado_servicio
                 FROM suscripciones_recurrentes s
                 WHERE s.cliente_id = ? AND s.estado = 'activo'
                 ORDER BY s.fecha_expiracion ASC`,
                [clienteId]
            );

            res.json({
                success: true,
                data: suscripciones
            });
        } catch (error) {
            console.error('Error al listar suscripciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener las suscripciones'
            });
        }
    }

    // Renovar una suscripción
    static async renovar(req, res) {
        try {
            const suscripcionId = req.params.id;
            const clienteId = req.user.id;

            // Verificar que la suscripción pertenezca al cliente
            const [suscripcion] = await pool.query(
                'SELECT * FROM suscripciones_recurrentes WHERE id = ? AND cliente_id = ?',
                [suscripcionId, clienteId]
            );

            if (suscripcion.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Suscripción no encontrada'
                });
            }

            const s = suscripcion[0];
            const montoRenovacion = s.precio_unitario;

            // Crear un pago para la renovación
            const nuevoPago = await PagoModel.crearPago(
                clienteId,
                s.proyecto_id,
                null, // No hay plan_pago específico
                montoRenovacion,
                'paypal'
            );

            // Guardar referencia en historial de renovaciones
            await pool.query(
                `INSERT INTO historial_renovaciones 
                 (suscripcion_id, periodo_inicio, periodo_fin, monto_pagado, fecha_renovacion, metodo_renovacion)
                 VALUES (?, DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), ?, CURDATE(), 'manual')`,
                [suscripcionId, montoRenovacion]
            );

            res.json({
                success: true,
                message: 'Iniciando proceso de renovación',
                data: {
                    pago_id: nuevoPago.id,
                    monto: montoRenovacion,
                    servicio: s.nombre_servicio
                }
            });
        } catch (error) {
            console.error('Error al renovar suscripción:', error);
            res.status(500).json({
                success: false,
                message: 'Error al procesar la renovación'
            });
        }
    }

    // Procesar renovación después del pago (webhook)
    static async procesarRenovacion(pagoId) {
        try {
            const [renovacion] = await pool.query(
                `SELECT hr.*, s.cliente_id, s.nombre_servicio
                 FROM historial_renovaciones hr
                 JOIN suscripciones_recurrentes s ON hr.suscripcion_id = s.id
                 WHERE hr.pago_id = ?
                 LIMIT 1`,
                [pagoId]
            );

            if (renovacion.length === 0) return;

            const suscripcionId = renovacion[0].suscripcion_id;

            // Actualizar fechas de la suscripción
            await pool.query(
                `UPDATE suscripciones_recurrentes 
                 SET fecha_inicio = DATE_ADD(fecha_expiracion, INTERVAL 1 DAY),
                     fecha_proxima_facturacion = DATE_ADD(fecha_expiracion, INTERVAL 1 YEAR),
                     fecha_expiracion = DATE_ADD(fecha_expiracion, INTERVAL 1 YEAR),
                     estado = 'activo'
                 WHERE id = ?`,
                [suscripcionId]
            );

            // Crear notificación
            await pool.query(
                `INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje)
                 VALUES (?, 'sistema', '✅ Servicio renovado', 
                         'Tu servicio "${renovacion[0].nombre_servicio}" ha sido renovado exitosamente por un año más')`,
                [renovacion[0].cliente_id]
            );
        } catch (error) {
            console.error('Error al procesar renovación:', error);
        }
    }

    // Cancelar suscripción (no renovar automáticamente)
    static async cancelar(req, res) {
        try {
            const suscripcionId = req.params.id;
            const clienteId = req.user.id;

            await pool.query(
                `UPDATE suscripciones_recurrentes 
                 SET renovacion_automatica = FALSE,
                     notificacion_envio_automatico = FALSE
                 WHERE id = ? AND cliente_id = ?`,
                [suscripcionId, clienteId]
            );

            res.json({
                success: true,
                message: 'La suscripción no se renovará automáticamente'
            });
        } catch (error) {
            console.error('Error al cancelar suscripción:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cancelar la suscripción'
            });
        }
    }

    // Activar renovación automática
    static async activarAutomatica(req, res) {
        try {
            const suscripcionId = req.params.id;
            const clienteId = req.user.id;

            await pool.query(
                `UPDATE suscripciones_recurrentes 
                 SET renovacion_automatica = TRUE,
                     notificacion_envio_automatico = TRUE
                 WHERE id = ? AND cliente_id = ?`,
                [suscripcionId, clienteId]
            );

            res.json({
                success: true,
                message: 'Renovación automática activada'
            });
        } catch (error) {
            console.error('Error al activar renovación automática:', error);
            res.status(500).json({
                success: false,
                message: 'Error al activar la renovación automática'
            });
        }
    }
}

module.exports = SuscripcionController;