// src/routes/proyectoRoutes.js
const express = require('express');
const ProyectoController = require('../controllers/proyectoController');
const { authMiddleware, verificarRol, verificarPropiedadCliente } = require('../middleware/authMiddleware');
const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas que admin y cliente pueden ver (con restricciones)
router.get('/', ProyectoController.listar);
router.get('/:id', verificarPropiedadCliente('id'), ProyectoController.obtener);

// Rutas solo para admin/desarrollador
router.post('/', verificarRol('admin', 'desarrollador'), ProyectoController.crear);
router.put('/:id', verificarRol('admin', 'desarrollador'), ProyectoController.actualizar);
router.patch('/:id/estado', verificarRol('admin', 'desarrollador'), ProyectoController.cambiarEstado);

module.exports = router;