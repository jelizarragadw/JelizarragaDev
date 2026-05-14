// src/controllers/dashboardController.js - VERSIÓN CORREGIDA CON LA ESTRUCTURA REAL
const { pool } = require('../config/database');

class DashboardController {
    // Resumen general para el cliente
    static async getResumen(req, res) {
        try {
            const clienteId = req.user.id;
            
            // 1. Estadísticas de proyectos
            const [proyectosStats] = await pool.query(
                `SELECT 
                    COUNT(CASE WHEN estado_proyecto IN ('en_desarrollo', 'revision', 'aprobado') THEN 1 END) AS proyectos_activos,
                    COUNT(CASE WHEN estado_proyecto = 'entregado' THEN 1 END) AS proyectos_completados,
                    COUNT(CASE WHEN estado_proyecto = 'pausado' THEN 1 END) AS proyectos_pausados,
                    COUNT(*) AS total_proyectos
                 FROM proyectos
                 WHERE cliente_id = ?`,
                [clienteId]
            );
            
            // 2. Resumen financiero - CORREGIDO: usando 'monto' en lugar de 'costo_total'
            const [financiero] = await pool.query(
                `SELECT 
                    COALESCE((SELECT SUM(monto) FROM pagos WHERE cliente_id = ? AND estado_pago = 'completado'), 0) AS total_pagado,
                    COALESCE((
                        SELECT SUM(pp.monto) 
                        FROM planes_pago pp
                        JOIN proyectos p ON pp.proyecto_id = p.id
                        WHERE p.cliente_id = ? AND pp.estado_cuota = 'pendiente'
                    ), 0) AS deuda_pendiente,
                    COALESCE((
                        SELECT SUM(monto_total) 
                        FROM cargos_extra 
                        WHERE proyecto_id IN (SELECT id FROM proyectos WHERE cliente_id = ?) 
                        AND estado = 'pendiente'
                    ), 0) AS cargos_extra_pendientes
                `,
                [clienteId, clienteId, clienteId]
            );
            
            // 3. Próximos pagos (planes de pago pendientes)
            const [proximosPagos] = await pool.query(
                `SELECT 
                    pp.id,
                    pp.numero_cuota,
                    pp.nombre_cuota,
                    pp.monto,
                    pp.fecha_limite,
                    DATEDIFF(pp.fecha_limite, CURDATE()) AS dias_restantes,
                    p.nombre_proyecto,
                    CASE 
                        WHEN pp.fecha_limite < CURDATE() THEN 'vencido'
                        WHEN DATEDIFF(pp.fecha_limite, CURDATE()) <= 7 THEN 'urgente'
                        ELSE 'pendiente'
                    END AS prioridad
                FROM planes_pago pp
                JOIN proyectos p ON pp.proyecto_id = p.id
                WHERE p.cliente_id = ? 
                AND pp.estado_cuota = 'pendiente'
                AND pp.fecha_limite <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                ORDER BY pp.fecha_limite ASC
                LIMIT 10`,
                [clienteId]
            );
            
            // 4. Servicios activos (hosting, dominio, SSL)
            const [serviciosActivos] = await pool.query(
                `SELECT 
                    id,
                    tipo_servicio,
                    nombre_servicio,
                    precio_unitario,
                    fecha_inicio,
                    fecha_proxima_facturacion,
                    fecha_expiracion,
                    DATEDIFF(fecha_expiracion, CURDATE()) AS dias_restantes,
                    CASE 
                        WHEN DATEDIFF(fecha_expiracion, CURDATE()) <= 0 THEN 'expirado'
                        WHEN DATEDIFF(fecha_expiracion, CURDATE()) <= 7 THEN 'critico'
                        WHEN DATEDIFF(fecha_expiracion, CURDATE()) <= 30 THEN 'proximo'
                        ELSE 'vigente'
                    END AS estado_servicio,
                    renovacion_automatica
                FROM suscripciones_recurrentes
                WHERE cliente_id = ? AND estado = 'activo'
                ORDER BY fecha_expiracion ASC`,
                [clienteId]
            );
            
            // 5. Notificaciones no leídas
            const [notificacionesNoLeidas] = await pool.query(
                `SELECT 
                    id,
                    tipo_notificacion,
                    titulo,
                    mensaje,
                    fecha_creacion,
                    CASE 
                        WHEN DATEDIFF(NOW(), fecha_creacion) = 0 THEN 'hoy'
                        WHEN DATEDIFF(NOW(), fecha_creacion) = 1 THEN 'ayer'
                        ELSE CONCAT(DATEDIFF(NOW(), fecha_creacion), ' días')
                    END AS hace
                FROM notificaciones
                WHERE usuario_id = ? AND leido = FALSE
                ORDER BY fecha_creacion DESC
                LIMIT 10`,
                [clienteId]
            );
            
            // 6. Últimos pagos realizados - CORREGIDO: usando 'monto'
            const [ultimosPagos] = await pool.query(
                `SELECT 
                    p.id,
                    p.monto,
                    p.metodo_pago,
                    p.fecha_pago,
                    p.estado_pago,
                    pr.nombre_proyecto
                FROM pagos p
                LEFT JOIN proyectos pr ON p.proyecto_id = pr.id
                WHERE p.cliente_id = ? AND p.estado_pago = 'completado'
                ORDER BY p.fecha_pago DESC
                LIMIT 5`,
                [clienteId]
            );
            
            res.json({
                success: true,
                data: {
                    estadisticas: proyectosStats[0],
                    financiero: financiero[0],
                    proximos_pagos: proximosPagos,
                    servicios_activos: serviciosActivos,
                    notificaciones_pendientes: {
                        total: notificacionesNoLeidas.length,
                        items: notificacionesNoLeidas
                    },
                    ultimos_pagos: ultimosPagos
                }
            });
        } catch (error) {
            console.error('Error en dashboard resumen:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener datos del dashboard',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    
    // Detalle de un proyecto específico
    static async getDetalleProyecto(req, res) {
        try {
            const clienteId = req.user.id;
            const proyectoId = req.params.id;
            
            const [proyecto] = await pool.query(
                `SELECT p.*, 
                    c.nombre_completo as cliente_nombre,
                    c.email as cliente_email
                FROM proyectos p
                JOIN clientes c ON p.cliente_id = c.id
                WHERE p.id = ? AND p.cliente_id = ?`,
                [proyectoId, clienteId]
            );
            
            if (proyecto.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Proyecto no encontrado'
                });
            }
            
            const [planesPago] = await pool.query(
                `SELECT * FROM planes_pago 
                WHERE proyecto_id = ? 
                ORDER BY orden_pago ASC`,
                [proyectoId]
            );
            
            const [pagosRealizados] = await pool.query(
                `SELECT p.*, pr.nombre_proyecto 
                FROM pagos p
                LEFT JOIN proyectos pr ON p.proyecto_id = pr.id
                WHERE p.proyecto_id = ? AND p.estado_pago = 'completado'
                ORDER BY p.fecha_pago DESC`,
                [proyectoId]
            );
            
            const [tickets] = await pool.query(
                `SELECT * FROM tickets_soporte 
                WHERE proyecto_id = ? 
                ORDER BY fecha_creacion DESC
                LIMIT 5`,
                [proyectoId]
            );
            
            res.json({
                success: true,
                data: {
                    proyecto: proyecto[0],
                    plan_pagos: planesPago,
                    pagos_realizados: pagosRealizados,
                    tickets_soporte: tickets
                }
            });
        } catch (error) {
            console.error('Error en detalle proyecto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener detalle del proyecto'
            });
        }
    }
    
    // Marcar notificación como leída
    static async marcarNotificacionLeida(req, res) {
        try {
            const clienteId = req.user.id;
            const notificacionId = req.params.id;
            
            const [result] = await pool.query(
                `UPDATE notificaciones 
                SET leido = TRUE, leido_en = NOW()
                WHERE id = ? AND usuario_id = ?`,
                [notificacionId, clienteId]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada'
                });
            }
            
            res.json({
                success: true,
                message: 'Notificación marcada como leída'
            });
        } catch (error) {
            console.error('Error al marcar notificación:', error);
            res.status(500).json({
                success: false,
                message: 'Error al procesar la notificación'
            });
        }
    }
    
    // Marcar todas las notificaciones como leídas
    static async marcarTodasNotificacionesLeidas(req, res) {
        try {
            const clienteId = req.user.id;
            
            await pool.query(
                `UPDATE notificaciones 
                SET leido = TRUE, leido_en = NOW()
                WHERE usuario_id = ? AND leido = FALSE`,
                [clienteId]
            );
            
            res.json({
                success: true,
                message: 'Todas las notificaciones marcadas como leídas'
            });
        } catch (error) {
            console.error('Error al marcar todas notificaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al procesar las notificaciones'
            });
        }
    }
    
    // Dashboard para administrador
    static async getDashboardAdmin(req, res) {
        try {
            if (req.user.rol !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso denegado. Se requiere rol de administrador'
                });
            }
            
            const [stats] = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM clientes WHERE estado_cliente = 'activo') AS clientes_activos,
                    (SELECT COUNT(*) FROM clientes) AS total_clientes,
                    (SELECT COUNT(*) FROM proyectos WHERE estado_proyecto IN ('en_desarrollo', 'revision')) AS proyectos_en_curso,
                    (SELECT COUNT(*) FROM proyectos) AS total_proyectos,
                    (SELECT COUNT(*) FROM pagos WHERE estado_pago = 'pendiente_verificacion') AS pagos_por_verificar,
                    (SELECT COUNT(*) FROM tickets_soporte WHERE estado = 'abierto') AS tickets_abiertos,
                    (SELECT COUNT(*) FROM suscripciones_recurrentes WHERE estado = 'activo' AND fecha_expiracion <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS renovaciones_proximas
            `);
            
            const [ingresosMensuales] = await pool.query(`
                SELECT 
                    DATE_FORMAT(fecha_pago, '%Y-%m') AS mes,
                    SUM(monto) AS total,
                    COUNT(*) AS cantidad
                FROM pagos
                WHERE estado_pago = 'completado'
                AND fecha_pago >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY DATE_FORMAT(fecha_pago, '%Y-%m')
                ORDER BY mes DESC
            `);
            
            const [proyectosPorEstado] = await pool.query(`
                SELECT 
                    estado_proyecto,
                    COUNT(*) AS cantidad
                FROM proyectos
                GROUP BY estado_proyecto
            `);
            
            const [clientesMorosos] = await pool.query(`
                SELECT DISTINCT 
                    c.id,
                    c.nombre_completo,
                    c.email,
                    c.telefono,
                    (
                        SELECT SUM(pp.monto) 
                        FROM planes_pago pp
                        JOIN proyectos p ON pp.proyecto_id = p.id
                        WHERE p.cliente_id = c.id AND pp.estado_cuota = 'vencido'
                    ) AS deuda_vencida
                FROM clientes c
                JOIN proyectos p ON c.id = p.cliente_id
                JOIN planes_pago pp ON p.id = pp.proyecto_id
                WHERE pp.estado_cuota = 'vencido'
                AND pp.fecha_limite < CURDATE()
                LIMIT 10
            `);
            
            res.json({
                success: true,
                data: {
                    estadisticas: stats[0],
                    ingresos_mensuales: ingresosMensuales,
                    proyectos_por_estado: proyectosPorEstado,
                    clientes_morosos: clientesMorosos
                }
            });
        } catch (error) {
            console.error('Error en dashboard admin:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener datos del dashboard'
            });
        }
    }
}

module.exports = DashboardController;