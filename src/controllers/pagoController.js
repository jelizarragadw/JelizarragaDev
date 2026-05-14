// src/controllers/pagoController.js
const PagoModel = require('../models/PagoModel');
const { client } = require('../config/paypal');
const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');
const { pool } = require('../config/database');

class PagoController {
    // Crear orden de PayPal
    static async crearOrdenPaypal(req, res) {
        try {
            const { proyecto_id, plan_pago_id, monto, moneda = 'MXN' } = req.body;
            const clienteId = req.user.id;

            // Verificar si ya existe un pago para este plan
            const pagoExistente = await PagoModel.verificarPagoExistente(plan_pago_id);
            if (pagoExistente && pagoExistente.estado_pago === 'completado') {
                return res.status(400).json({
                    success: false,
                    message: 'Este pago ya fue completado'
                });
            }

            // Crear registro de pago
            const nuevoPago = await PagoModel.crearPago(
                clienteId,
                proyecto_id,
                plan_pago_id,
                monto,
                'paypal'
            );

            // Crear orden en PayPal
            const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
            request.prefer('return=representation');
            request.requestBody({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: moneda,
                        value: monto.toString(),
                        breakdown: {
                            item_total: {
                                currency_code: moneda,
                                value: monto.toString()
                            }
                        }
                    },
                    description: `Pago de proyecto - Referencia: ${nuevoPago.uuid_transaccion}`,
                    custom_id: nuevoPago.uuid_transaccion,
                    invoice_id: nuevoPago.uuid_transaccion
                }],
                application_context: {
                    brand_name: process.env.EMPRESA_NOMBRE || 'Mi Empresa',
                    landing_page: 'BILLING',
                    user_action: 'PAY_NOW',
                    return_url: `${process.env.API_URL}/api/pagos/ejecutar-paypal`,
                    cancel_url: `${process.env.FRONTEND_URL}/pagos/cancelar`
                }
            });

            const order = await client().execute(request);

            res.json({
                success: true,
                data: {
                    pago_id: nuevoPago.id,
                    order_id: order.result.id,
                    approve_url: order.result.links.find(link => link.rel === 'approve').href
                }
            });
        } catch (error) {
            console.error('Error al crear orden PayPal:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear la orden de pago'
            });
        }
    }

    // src/controllers/pagoController.js - Método capturarPaypal mejorado

    static async capturarPaypal(req, res) {
        try {
            console.log('=== INICIO CAPTURA PAYPAL ===');
            const { order_id, pago_id } = req.body;

            console.log('Datos recibidos:', { order_id, pago_id, user_id: req.user.id });

            if (!order_id || !pago_id) {
                console.log('❌ Faltan datos: order_id o pago_id');
                return res.status(400).json({
                    success: false,
                    message: 'Faltan datos: order_id y pago_id son requeridos'
                });
            }

            // Verificar que el pago existe y pertenece al cliente
            console.log('1. Verificando pago en BD...');
            const [pagoInfo] = await pool.query(
                'SELECT * FROM pagos WHERE id = ? AND cliente_id = ?',
                [pago_id, req.user.id]
            );

            console.log('Pago encontrado:', pagoInfo.length > 0 ? 'Sí' : 'No');

            if (pagoInfo.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Pago no encontrado o no pertenece al usuario'
                });
            }

            // Capturar la orden en PayPal
            console.log('2. Intentando capturar orden en PayPal...');
            console.log('Order ID:', order_id);

            const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(order_id);
            request.requestBody({});

            const capture = await client().execute(request);

            console.log('3. Respuesta de PayPal recibida');
            console.log('Estado de la orden:', capture.result.status);

            if (capture.result.status === 'COMPLETED') {
                console.log('✅ Pago completado exitosamente');

                const purchaseUnit = capture.result.purchase_units[0];
                const captureDetails = purchaseUnit.payments.captures[0];

                console.log('Detalles de captura:', {
                    id: captureDetails.id,
                    amount: captureDetails.amount.value,
                    status: captureDetails.status
                });

                // Actualizar estado del pago
                await PagoModel.actualizarEstado(pago_id, 'completado', {
                    fecha_pago: new Date(),
                    notas_pago: `Pago completado via PayPal. Transaction ID: ${captureDetails.id}`
                });

                // Guardar detalles de la transacción PayPal
                await PagoModel.guardarTransaccionPaypal(pago_id, {
                    paypal_order_id: order_id,
                    paypal_payer_id: capture.result.payer?.payer_id || null,
                    paypal_transaction_id: captureDetails.id,
                    paypal_status: capture.result.status,
                    payer_email: capture.result.payer?.email_address || null,
                    payer_name: capture.result.payer?.name ? `${capture.result.payer.name.given_name} ${capture.result.payer.name.surname}` : null,
                    paypal_fee: parseFloat(captureDetails.seller_receivable_breakdown?.paypal_fee?.value || 0),
                    net_amount: parseFloat(captureDetails.seller_receivable_breakdown?.net_amount?.value || captureDetails.amount.value),
                    currency_code: captureDetails.amount.currency_code,
                    capture_id: captureDetails.id,
                    capture_status: captureDetails.status,
                    capture_date: new Date(),
                    raw_response: capture.result
                });

                // Si el pago corresponde a un plan de pago, actualizar estado de la cuota
                if (pagoInfo[0].plan_pago_id) {
                    console.log('Actualizando estado de cuota...');
                    await pool.query(
                        'UPDATE planes_pago SET estado_cuota = "pagado_total" WHERE id = ?',
                        [pagoInfo[0].plan_pago_id]
                    );
                }

                // Crear notificación para el cliente
                await pool.query(
                    `INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje)
                 VALUES (?, 'pago_recibido', '✅ Pago recibido', 
                         'Hemos recibido tu pago de €${captureDetails.amount.value} correctamente. ¡Gracias!')`,
                    [req.user.id]
                );

                console.log('=== FIN CAPTURA EXITOSA ===');

                res.json({
                    success: true,
                    message: 'Pago completado exitosamente',
                    data: {
                        transaction_id: captureDetails.id,
                        amount: captureDetails.amount.value,
                        currency: captureDetails.amount.currency_code
                    }
                });
            } else {
                console.log('❌ Pago no completado. Estado:', capture.result.status);
                res.status(400).json({
                    success: false,
                    message: `El pago no pudo ser completado. Estado: ${capture.result.status}`
                });
            }
        } catch (error) {
            console.error('❌ ERROR EN CAPTURA PAYPAL:');
            console.error('Mensaje:', error.message);
            console.error('Stack:', error.stack);

            // Mostrar más detalles del error si es de PayPal
            if (error.statusCode) {
                console.error('Status Code:', error.statusCode);
                console.error('Detalles:', error.details);
            }

            res.status(500).json({
                success: false,
                message: 'Error al procesar el pago',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // src/controllers/pagoController.js - Agrega este método

    static async ejecutarPaypal(req, res) {
        try {
            console.log('=== EJECUTAR PAYPAL (RETURN URL) ===');
            const { token, PayerID } = req.query; // PayPal envía estos parámetros

            console.log('Token recibido:', token);
            console.log('PayerID recibido:', PayerID);

            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'No se recibió el token de PayPal'
                });
            }

            // Buscar el pago por el order_id
            const [pago] = await pool.query(
                'SELECT id FROM pagos WHERE uuid_transaccion IN (SELECT paypal_order_id FROM transacciones_paypal WHERE paypal_order_id = ?)',
                [token]
            );

            // También buscar en transacciones_paypal
            let pagoId = null;
            let clienteId = null;

            const [transaccion] = await pool.query(
                'SELECT pago_id FROM transacciones_paypal WHERE paypal_order_id = ?',
                [token]
            );

            if (transaccion.length > 0) {
                pagoId = transaccion[0].pago_id;
                const [pagoInfo] = await pool.query(
                    'SELECT cliente_id FROM pagos WHERE id = ?',
                    [pagoId]
                );
                clienteId = pagoInfo[0]?.cliente_id;
            }

            if (!pagoId) {
                return res.status(404).json({
                    success: false,
                    message: 'Orden no encontrada'
                });
            }

            // Capturar la orden
            const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(token);
            request.requestBody({});

            const capture = await client().execute(request);

            if (capture.result.status === 'COMPLETED') {
                const purchaseUnit = capture.result.purchase_units[0];
                const captureDetails = purchaseUnit.payments.captures[0];

                // Actualizar estado del pago
                await PagoModel.actualizarEstado(pagoId, 'completado', {
                    fecha_pago: new Date(),
                    notas_pago: `Pago completado via PayPal. Transaction ID: ${captureDetails.id}`
                });

                // Actualizar transacción PayPal
                await pool.query(
                    `UPDATE transacciones_paypal 
                 SET paypal_status = ?, 
                     paypal_payer_id = ?,
                     capture_id = ?,
                     capture_status = ?,
                     capture_date = NOW()
                 WHERE paypal_order_id = ?`,
                    [capture.result.status, PayerID, captureDetails.id, captureDetails.status, token]
                );

                // Actualizar cuota si existe
                const [pagoInfo] = await pool.query(
                    'SELECT plan_pago_id FROM pagos WHERE id = ?',
                    [pagoId]
                );

                if (pagoInfo[0] && pagoInfo[0].plan_pago_id) {
                    await pool.query(
                        'UPDATE planes_pago SET estado_cuota = "pagado_total" WHERE id = ?',
                        [pagoInfo[0].plan_pago_id]
                    );
                }

                // Redirigir al frontend con éxito
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                res.redirect(`${frontendUrl}/pagos/exito?pago_id=${pagoId}&transaction_id=${captureDetails.id}`);
            } else {
                res.redirect(`${process.env.FRONTEND_URL}/pagos/error?motivo=pago_no_completado`);
            }
        } catch (error) {
            console.error('Error en ejecutar PayPal:', error);
            res.redirect(`${process.env.FRONTEND_URL}/pagos/error?motivo=${error.message}`);
        }
    }

    // Subir comprobante de transferencia (método manual)
    static async subirComprobante(req, res) {
        try {
            const { pago_id, comprobante_url, banco_origen, numero_referencia } = req.body;
            const clienteId = req.user.id;

            // Verificar que el pago pertenezca al cliente
            const [pago] = await pool.query(
                'SELECT id FROM pagos WHERE id = ? AND cliente_id = ?',
                [pago_id, clienteId]
            );

            if (pago.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Pago no encontrado'
                });
            }

            // Actualizar pago
            await PagoModel.actualizarEstado(pago_id, 'pendiente_verificacion', {
                comprobante_url,
                notas_pago: `Comprobante subido. Banco: ${banco_origen}, Ref: ${numero_referencia}`
            });

            // Guardar en transacciones_transferencia
            await pool.query(
                `INSERT INTO transacciones_transferencia (pago_id, banco_origen, numero_referencia, comprobante_subido)
                 VALUES (?, ?, ?, ?)`,
                [pago_id, banco_origen, numero_referencia, comprobante_url]
            );

            // Notificar al admin (crear notificación)
            await pool.query(
                `INSERT INTO notificaciones (usuario_sistema_id, tipo_notificacion, titulo, mensaje)
                 VALUES ((SELECT id FROM usuarios_sistema WHERE rol = 'admin' LIMIT 1), 
                         'pago_recibido', 
                         'Nuevo comprobante por verificar',
                         'El cliente ha subido un comprobante de pago. Revisa y verifica.')`
            );

            res.json({
                success: true,
                message: 'Comprobante subido. En espera de verificación'
            });
        } catch (error) {
            console.error('Error al subir comprobante:', error);
            res.status(500).json({
                success: false,
                message: 'Error al subir el comprobante'
            });
        }
    }

    // Verificar pago (solo admin)
    static async verificarPago(req, res) {
        try {
            const pagoId = req.params.id;

            // Verificar que el admin tenga permisos
            if (req.user.rol !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso denegado'
                });
            }

            await PagoModel.actualizarEstado(pagoId, 'completado', {
                fecha_pago: new Date(),
                notas_pago: 'Pago verificado por administrador',
                verificado_por: req.user.id,
                fecha_verificacion: new Date()
            });

            // Actualizar estado de la cuota
            const [pagoInfo] = await pool.query(
                'SELECT plan_pago_id FROM pagos WHERE id = ?',
                [pagoId]
            );

            if (pagoInfo[0] && pagoInfo[0].plan_pago_id) {
                await pool.query(
                    'UPDATE planes_pago SET estado_cuota = "pagado_total" WHERE id = ?',
                    [pagoInfo[0].plan_pago_id]
                );
            }

            res.json({
                success: true,
                message: 'Pago verificado exitosamente'
            });
        } catch (error) {
            console.error('Error al verificar pago:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar el pago'
            });
        }
    }

    // Historial de pagos del cliente
    static async historialPagos(req, res) {
        try {
            const clienteId = req.user.id;
            const pagos = await PagoModel.obtenerPagosCliente(clienteId);

            res.json({
                success: true,
                data: pagos
            });
        } catch (error) {
            console.error('Error al obtener historial:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener el historial de pagos'
            });
        }
    }

    // Detalle de un pago específico
    static async detallePago(req, res) {
        try {
            const pagoId = req.params.id;
            const clienteId = req.user.rol === 'cliente' ? req.user.id : null;

            const pago = await PagoModel.obtenerPago(pagoId, clienteId);

            if (!pago) {
                return res.status(404).json({
                    success: false,
                    message: 'Pago no encontrado'
                });
            }

            res.json({
                success: true,
                data: pago
            });
        } catch (error) {
            console.error('Error al obtener detalle:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener el detalle del pago'
            });
        }
    }
}

module.exports = PagoController;