// src/controllers/ticketController.js
const TicketModel = require('../models/TicketModel');
const { pool } = require('../config/database');
const NotificationService = require('../services/notificationService');

class TicketController {
    // Listar tickets
    static async listar(req, res) {
        try {
            const filtros = req.query;
            const clienteId = req.user.rol === 'cliente' ? req.user.id : null;

            const tickets = await TicketModel.findAll(filtros, clienteId);

            res.json({
                success: true,
                data: tickets,
                total: tickets.length
            });
        } catch (error) {
            console.error('Error al listar tickets:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener los tickets'
            });
        }
    }

    // Obtener un ticket con sus respuestas
    static async obtener(req, res) {
        try {
            const ticketId = req.params.id;
            const clienteId = req.user.rol === 'cliente' ? req.user.id : null;

            const ticket = await TicketModel.findById(ticketId, clienteId);

            if (!ticket) {
                return res.status(404).json({
                    success: false,
                    message: 'Ticket no encontrado'
                });
            }

            const respuestas = await TicketModel.getRespuestas(ticketId);

            res.json({
                success: true,
                data: {
                    ticket,
                    respuestas
                }
            });
        } catch (error) {
            console.error('Error al obtener ticket:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener el ticket'
            });
        }
    }

    // Crear nuevo ticket
    static async crear(req, res) {
        try {
            const { proyecto_id, asunto, descripcion, prioridad, categoria } = req.body;
            const clienteId = req.user.id;

            if (!asunto || !descripcion) {
                return res.status(400).json({
                    success: false,
                    message: 'Asunto y descripción son requeridos'
                });
            }

            const ticketId = await TicketModel.create({
                cliente_id: clienteId,
                proyecto_id,
                asunto,
                descripcion,
                prioridad: prioridad || 'media',
                categoria: categoria || 'consulta'
            });

            // Crear notificación para el admin
            await pool.query(
                `INSERT INTO notificaciones (usuario_sistema_id, tipo_notificacion, titulo, mensaje)
                 VALUES ((SELECT id FROM usuarios_sistema WHERE rol = 'admin' LIMIT 1), 
                         'soporte', 
                         '📩 Nuevo ticket de soporte',
                         'El cliente ha abierto un nuevo ticket: "${asunto}"')`
            );

            // Enviar email al admin (opcional)
            await NotificationService.enviarNotificacionNuevoTicket(
                ticketId,
                req.user.nombre,
                asunto
            );

            res.status(201).json({
                success: true,
                message: 'Ticket creado exitosamente',
                data: { ticket_id: ticketId }
            });
        } catch (error) {
            console.error('Error al crear ticket:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear el ticket'
            });
        }
    }

    // Responder ticket
    static async responder(req, res) {
        try {
            const ticketId = req.params.id;
            const { mensaje } = req.body;
            const usuarioId = req.user.id;
            const esAdmin = req.user.rol !== 'cliente';

            if (!mensaje) {
                return res.status(400).json({
                    success: false,
                    message: 'El mensaje es requerido'
                });
            }

            // Verificar que el ticket existe y pertenece al cliente si es necesario
            const ticket = await TicketModel.findById(ticketId, !esAdmin ? req.user.id : null);

            if (!ticket) {
                return res.status(404).json({
                    success: false,
                    message: 'Ticket no encontrado'
                });
            }

            if (ticket.estado === 'cerrado') {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede responder a un ticket cerrado'
                });
            }

            // Agregar respuesta
            const respuestaId = await TicketModel.addRespuesta(ticketId, {
                usuario_sistema_id: esAdmin ? usuarioId : null,
                cliente_id: !esAdmin ? req.user.id : null,
                mensaje
            });

            // Notificar al otro lado
            if (esAdmin) {
                // Notificar al cliente
                await pool.query(
                    `INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje, url_enlace)
                     VALUES (?, 'soporte', 
                             '📨 Respuesta a tu ticket',
                             'Han respondido a tu ticket: "${ticket.asunto}"',
                             '/soporte/tickets/${ticketId}')`,
                    [ticket.cliente_id]
                );
            } else {
                // Notificar a los admins
                await pool.query(
                    `INSERT INTO notificaciones (usuario_sistema_id, tipo_notificacion, titulo, mensaje, url_enlace)
                     SELECT id, 'soporte', 
                            '💬 Nueva respuesta en ticket',
                            'El cliente ha respondido al ticket: "${ticket.asunto}"',
                            '/admin/tickets/${ticketId}'
                     FROM usuarios_sistema 
                     WHERE rol IN ('admin', 'soporte')`,
                    []
                );
            }

            res.json({
                success: true,
                message: 'Respuesta agregada exitosamente',
                data: { respuesta_id: respuestaId }
            });
        } catch (error) {
            console.error('Error al responder ticket:', error);
            res.status(500).json({
                success: false,
                message: 'Error al agregar la respuesta'
            });
        }
    }

    // Cambiar estado del ticket (admin)
    static async cambiarEstado(req, res) {
        try {
            const ticketId = req.params.id;
            const { estado } = req.body;

            const estadosValidos = ['abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado'];

            if (!estadosValidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado no válido'
                });
            }

            const ticket = await TicketModel.findById(ticketId);

            if (!ticket) {
                return res.status(404).json({
                    success: false,
                    message: 'Ticket no encontrado'
                });
            }

            await TicketModel.updateEstado(ticketId, estado, req.user.id);

            // Notificar al cliente si el ticket se cierra o resuelve
            if (estado === 'resuelto' || estado === 'cerrado') {
                await pool.query(
                    `INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje)
                     VALUES (?, 'soporte', 
                             '✅ Ticket ${estado === 'resuelto' ? 'resuelto' : 'cerrado'}',
                             'Tu ticket "${ticket.asunto}" ha sido marcado como ${estado}')`,
                    [ticket.cliente_id]
                );
            }

            res.json({
                success: true,
                message: `Estado actualizado a: ${estado}`
            });
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar el estado del ticket'
            });
        }
    }

    // Cambiar prioridad (admin)
    static async cambiarPrioridad(req, res) {
        try {
            const ticketId = req.params.id;
            const { prioridad } = req.body;

            const prioridadesValidas = ['baja', 'media', 'alta', 'critica'];

            if (!prioridadesValidas.includes(prioridad)) {
                return res.status(400).json({
                    success: false,
                    message: 'Prioridad no válida'
                });
            }

            await TicketModel.updatePrioridad(ticketId, prioridad);

            res.json({
                success: true,
                message: `Prioridad actualizada a: ${prioridad}`
            });
        } catch (error) {
            console.error('Error al cambiar prioridad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar la prioridad'
            });
        }
    }

    // Estadísticas del cliente
    static async estadisticas(req, res) {
        try {
            const clienteId = req.user.id;
            const estadisticas = await TicketModel.getEstadisticas(clienteId);

            res.json({
                success: true,
                data: estadisticas
            });
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas'
            });
        }
    }

    // Estadísticas generales (admin)
    static async estadisticasGenerales(req, res) {
        try {
            if (req.user.rol === 'cliente') {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso denegado'
                });
            }

            const estadisticas = await TicketModel.getEstadisticasGenerales();

            // Tickets por categoría
            const [porCategoria] = await pool.query(
                `SELECT categoria, COUNT(*) as total 
                 FROM tickets_soporte 
                 GROUP BY categoria`
            );

            // Tickets por mes
            const [porMes] = await pool.query(
                `SELECT DATE_FORMAT(fecha_creacion, '%Y-%m') as mes, 
                        COUNT(*) as total,
                        AVG(CASE WHEN estado = 'resuelto' THEN 1 ELSE 0 END) * 100 as tasa_resolucion
                 FROM tickets_soporte 
                 WHERE fecha_creacion >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                 GROUP BY DATE_FORMAT(fecha_creacion, '%Y-%m')
                 ORDER BY mes DESC`
            );

            res.json({
                success: true,
                data: {
                    generales: estadisticas,
                    por_categoria: porCategoria,
                    por_mes: porMes
                }
            });
        } catch (error) {
            console.error('Error al obtener estadísticas generales:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas'
            });
        }
    }
}

module.exports = TicketController;