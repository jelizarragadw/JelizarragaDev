// src/routes/clienteRoutes.js
const express = require('express');
const { authMiddleware, verificarRol } = require('../middleware/authMiddleware');
const router = express.Router();

// Solo admin puede acceder a rutas de clientes
router.get('/', authMiddleware, verificarRol('admin'), (req, res) => {
    res.status(200).json({ message: 'Lista de clientes - en desarrollo' });
});

router.get('/:id', authMiddleware, verificarRol('admin'), (req, res) => {
    res.status(200).json({ message: 'Detalle de cliente - en desarrollo', id: req.params.id });
});

router.post('/', authMiddleware, verificarRol('admin'), (req, res) => {
    res.status(200).json({ message: 'Crear cliente - en desarrollo' });
});

router.put('/:id', authMiddleware, verificarRol('admin'), (req, res) => {
    res.status(200).json({ message: 'Actualizar cliente - en desarrollo', id: req.params.id });
});

module.exports = router;