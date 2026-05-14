// src/services/notificationService.js
const { pool } = require('../config/database');
const nodemailer = require('nodemailer');

class NotificationService {
    static async enviarRecordatoriosVencimiento() {
        try {
            // Buscar suscripciones que vencen en los próximos 30 días
            const [suscripciones] = await pool.query(`
                SELECT s.*, c.nombre_completo, c.email,
                       DATEDIFF(s.fecha_expiracion, CURDATE()) AS dias_restantes
                FROM suscripciones_recurrentes s
                JOIN clientes c ON s.cliente_id = c.id
                WHERE s.estado = 'activo'
                AND s.fecha_expiracion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                AND s.notificacion_envio_automatico = TRUE
            `);

            for (const s of suscripciones) {
                // Verificar si ya se envió recordatorio para este plazo
                const [yaEnviado] = await pool.query(
                    'SELECT id FROM recordatorios_programados WHERE suscripcion_id = ? AND dias_anticipacion = ? AND DATE(fecha_programada) = CURDATE()',
                    [s.id, s.dias_restantes]
                );

                if (yaEnviado.length === 0 && s.dias_restantes <= 7) {
                    // Crear notificación en el sistema
                    await pool.query(
                        `INSERT INTO recordatorios_programados (suscripcion_id, tipo_recordatorio, dias_anticipacion, fecha_programada)
                         VALUES (?, 'vencimiento', ?, CURDATE())`,
                        [s.id, s.dias_restantes]
                    );

                    // Crear notificación para el cliente
                    await pool.query(
                        `INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje)
                         VALUES (?, 'recordatorio', 
                                 'Tu servicio está por vencer',
                                 'Tu servicio "${s.nombre_servicio}" vence en ${s.dias_restantes} días. Renueva para evitar interrupciones.')`,
                        [s.cliente_id]
                    );

                    // Enviar email (opcional)
                    await this.enviarEmailRecordatorio(s.email, s.nombre_completo, s.nombre_servicio, s.dias_restantes);
                }
            }

            console.log(`Recordatorios procesados: ${suscripciones.length} suscripciones revisadas`);
        } catch (error) {
            console.error('Error al enviar recordatorios:', error);
        }
    }

    static async enviarEmailRecordatorio(email, nombre, servicio, diasRestantes) {
        try {
            // Configurar transporter con tu servicio de email
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                from: `"${process.env.EMPRESA_NOMBRE}" <${process.env.EMAIL_FROM}>`,
                to: email,
                subject: `⚠️ Tu servicio "${servicio}" está por vencer`,
                html: `
                    <h2>Hola ${nombre},</h2>
                    <p>Tu servicio <strong>${servicio}</strong> vence en <strong>${diasRestantes} días</strong>.</p>
                    <p>Ingresa a tu panel para renovar y evitar interrupciones.</p>
                    <a href="${process.env.FRONTEND_URL}/suscripciones" style="background:#0070ba;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
                        Renovar ahora
                    </a>
                    <br><br>
                    <p>¡Gracias por confiar en nosotros!</p>
                `
            });
        } catch (error) {
            console.error('Error al enviar email:', error);
        }
    }

    // Ejecutar diariamente (llamar desde un cron job)
    static async ejecutarTareasDiarias() {
        console.log('Ejecutando tareas diarias...');

        // 1. Enviar recordatorios
        await this.enviarRecordatoriosVencimiento();

        // 2. Actualizar suscripciones expiradas
        await pool.query(
            `UPDATE suscripciones_recurrentes 
             SET estado = 'expirado' 
             WHERE fecha_expiracion < CURDATE() AND estado = 'activo'`
        );

        // 3. Crear notificaciones para servicios expirados
        await pool.query(`
            INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje)
            SELECT s.cliente_id, 'sistema', 'Servicio expirado',
                   CONCAT('Tu servicio "', s.nombre_servicio, '" ha expirado. Renueva para reactivarlo.')
            FROM suscripciones_recurrentes s
            WHERE s.fecha_expiracion = CURDATE() - INTERVAL 1 DAY
            AND s.estado = 'expirado'
        `);

        console.log('Tareas diarias completadas');
    }

    // src/services/notificationService.js - Agrega este método
    static async enviarNotificacionNuevoTicket(ticketId, clienteNombre, asunto) {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            // Obtener emails de admins
            const [admins] = await pool.query(
                "SELECT email FROM usuarios_sistema WHERE rol IN ('admin', 'soporte') AND activo = TRUE"
            );

            for (const admin of admins) {
                await transporter.sendMail({
                    from: `"${process.env.EMPRESA_NOMBRE}" <${process.env.EMAIL_FROM}>`,
                    to: admin.email,
                    subject: `Nuevo ticket de soporte: ${asunto}`,
                    html: `
                    <h2>Nuevo ticket de soporte</h2>
                    <p><strong>Cliente:</strong> ${clienteNombre}</p>
                    <p><strong>Asunto:</strong> ${asunto}</p>
                    <p><strong>Ticket ID:</strong> #${ticketId}</p>
                    <a href="${process.env.FRONTEND_URL}/admin/tickets/${ticketId}" 
                       style="background:#0070ba;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">
                        Ver ticket
                    </a>
                `
                });
            }
        } catch (error) {
            console.error('Error al enviar notificación de nuevo ticket:', error);
        }
    }
}

module.exports = NotificationService;