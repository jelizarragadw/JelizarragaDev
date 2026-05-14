// src/controllers/proyectoController.js
const ProyectoModel = require('../models/ProyectoModel');
const { pool } = require('../config/database');

class ProyectoController {
    // Listar proyectos
    static async listar(req, res) {
        try {
            const filtros = req.query;
            const clienteId = req.user.rol === 'cliente' ? req.user.id : null;

            const proyectos = await ProyectoModel.findAll(filtros, clienteId);

            res.json({
                success: true,
                data: proyectos,
                total: proyectos.length
            });
        } catch (error) {
            console.error('Error al listar proyectos:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener los proyectos'
            });
        }
    }

    // Obtener un proyecto
    static async obtener(req, res) {
        try {
            const proyectoId = req.params.id;
            const clienteId = req.user.rol === 'cliente' ? req.user.id : null;

            const proyecto = await ProyectoModel.findById(proyectoId, clienteId);

            if (!proyecto) {
                return res.status(404).json({
                    success: false,
                    message: 'Proyecto no encontrado'
                });
            }

            // Obtener planes de pago
            const [planesPago] = await pool.query(
                'SELECT * FROM planes_pago WHERE proyecto_id = ? ORDER BY orden_pago ASC',
                [proyectoId]
            );

            // Obtener pagos realizados
            const [pagos] = await pool.query(
                `SELECT * FROM pagos WHERE proyecto_id = ? ORDER BY fecha_pago DESC`,
                [proyectoId]
            );

            // Resumen financiero
            const resumenFinanciero = await ProyectoModel.getResumenFinanciero(proyectoId);

            res.json({
                success: true,
                data: {
                    ...proyecto,
                    planes_pago: planesPago,
                    pagos: pagos,
                    resumen_financiero: resumenFinanciero
                }
            });
        } catch (error) {
            console.error('Error al obtener proyecto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener el proyecto'
            });
        }
    }

    // Crear proyecto
    static async crear(req, res) {
        try {
            const {
                cliente_id,
                nombre_proyecto,
                descripcion,
                tipo_proyecto,
                costo_total,
                numero_pagos, // 2 o 3
                primer_pago_monto,
                primer_pago_fecha,
                segundo_pago_monto,
                segundo_pago_fecha,
                tercer_pago_monto,
                tercer_pago_fecha,
                incluye_hosting,
                incluye_dominio,
                incluye_ssl,
                fecha_inicio,
                notas_internas
            } = req.body;

            // Validaciones
            if (!cliente_id || !nombre_proyecto || !tipo_proyecto || !costo_total) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan datos requeridos'
                });
            }

            // Construir planes de pago según número de pagos
            const planesPago = [];

            if (numero_pagos === 2) {
                planesPago.push({
                    nombre_cuota: 'Primer pago: Dominio + Hosting + SSL + Anticipo',
                    porcentaje: (primer_pago_monto / costo_total) * 100,
                    monto: primer_pago_monto,
                    fecha_limite: primer_pago_fecha
                });
                planesPago.push({
                    nombre_cuota: 'Segundo pago: Saldo final contra entrega',
                    porcentaje: (segundo_pago_monto / costo_total) * 100,
                    monto: segundo_pago_monto,
                    fecha_limite: segundo_pago_fecha
                });
            } else if (numero_pagos === 3) {
                planesPago.push({
                    nombre_cuota: 'Primer pago: Dominio + Hosting + SSL',
                    porcentaje: (primer_pago_monto / costo_total) * 100,
                    monto: primer_pago_monto,
                    fecha_limite: primer_pago_fecha
                });
                planesPago.push({
                    nombre_cuota: 'Segundo pago: Mitad del proyecto validada',
                    porcentaje: (segundo_pago_monto / costo_total) * 100,
                    monto: segundo_pago_monto,
                    fecha_limite: segundo_pago_fecha
                });
                planesPago.push({
                    nombre_cuota: 'Tercer pago: Saldo final contra entrega',
                    porcentaje: (tercer_pago_monto / costo_total) * 100,
                    monto: tercer_pago_monto,
                    fecha_limite: tercer_pago_fecha
                });
            }

            const proyectoData = {
                cliente_id,
                nombre_proyecto,
                descripcion,
                tipo_proyecto,
                costo_total,
                incluye_hosting: incluye_hosting || false,
                incluye_dominio: incluye_dominio || false,
                incluye_ssl: incluye_ssl || false,
                fecha_inicio: fecha_inicio || new Date(),
                notas_internas
            };

            const proyectoId = await ProyectoModel.create(proyectoData, planesPago);

            res.status(201).json({
                success: true,
                message: 'Proyecto creado exitosamente',
                data: { proyecto_id: proyectoId }
            });
        } catch (error) {
            console.error('Error al crear proyecto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear el proyecto'
            });
        }
    }

    // Actualizar proyecto
    static async actualizar(req, res) {
        try {
            const proyectoId = req.params.id;

            const actualizado = await ProyectoModel.update(proyectoId, req.body);

            if (!actualizado) {
                return res.status(404).json({
                    success: false,
                    message: 'Proyecto no encontrado o sin cambios'
                });
            }

            res.json({
                success: true,
                message: 'Proyecto actualizado exitosamente'
            });
        } catch (error) {
            console.error('Error al actualizar proyecto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar el proyecto'
            });
        }
    }

    // Cambiar estado del proyecto
    static async cambiarEstado(req, res) {
        try {
            const proyectoId = req.params.id;
            const { estado } = req.body;

            const estadosValidos = ['cotizacion', 'aprobado', 'en_desarrollo', 'pausado', 'revision', 'entregado', 'soporte', 'cancelado'];

            if (!estadosValidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado no válido'
                });
            }

            const actualizado = await ProyectoModel.cambiarEstado(proyectoId, estado);

            if (!actualizado) {
                return res.status(404).json({
                    success: false,
                    message: 'Proyecto no encontrado'
                });
            }

            // Crear notificación para el cliente
            await pool.query(
                `INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje)
                 VALUES ((SELECT cliente_id FROM proyectos WHERE id = ?), 'proyecto_actualizado', 
                         'Estado del proyecto actualizado', 
                         'Tu proyecto ha cambiado al estado: ' || ?)`,
                [proyectoId, estado]
            );

            res.json({
                success: true,
                message: `Estado del proyecto actualizado a: ${estado}`
            });
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar el estado del proyecto'
            });
        }
    }
}

module.exports = ProyectoController;