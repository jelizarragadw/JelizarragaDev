// src/routes/ticketRoutes.js
const express = require('express');
const TicketController = require('../controllers/ticketController');
const { authMiddleware, verificarRol, verificarPropiedadCliente } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(authMiddleware);

// Rutas para clientes
router.get('/', TicketController.listar);
router.get('/estadisticas', TicketController.estadisticas);
router.get('/:id', verificarPropiedadCliente('id'), TicketController.obtener);
router.post('/', TicketController.crear);
router.post('/:id/responder', verificarPropiedadCliente('id'), TicketController.responder);

// Rutas solo para admin
router.get('/admin/estadisticas', verificarRol('admin', 'soporte'), TicketController.estadisticasGenerales);
router.patch('/:id/estado', verificarRol('admin', 'soporte'), TicketController.cambiarEstado);
router.patch('/:id/prioridad', verificarRol('admin', 'soporte'), TicketController.cambiarPrioridad);

module.exports = router;