// src/routes/dashboardRoutes.js
const express = require('express');
const { authMiddleware, verificarRol } = require('../middleware/authMiddleware');
const DashboardController = require('../controllers/dashboardController');
const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas para clientes
router.get('/resumen', DashboardController.getResumen);
router.get('/proyecto/:id', DashboardController.getDetalleProyecto);
router.get('/admin', verificarRol('admin'), DashboardController.getDashboardAdmin);
router.put('/notificacion/:id/leer', DashboardController.marcarNotificacionLeida);
router.put('/notificaciones/leer-todas', DashboardController.marcarTodasNotificacionesLeidas);

// Rutas solo para admin
router.get('/admin', verificarRol('admin'), DashboardController.getDashboardAdmin);

module.exports = router;