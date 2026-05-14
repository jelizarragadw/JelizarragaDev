// src/routes/adminRoutes.js
const express = require('express');
const { authMiddleware, verificarRol } = require('../middleware/authMiddleware');
const router = express.Router();

// Todas las rutas de admin requieren rol admin
router.use(authMiddleware);
router.use(verificarRol('admin'));

router.get('/dashboard', (req, res) => {
    res.status(200).json({ message: 'Dashboard admin - en desarrollo' });
});

router.get('/estadisticas', (req, res) => {
    res.status(200).json({ message: 'Estadísticas - en desarrollo' });
});

router.get('/configuracion', (req, res) => {
    res.status(200).json({ message: 'Configuración - en desarrollo' });
});

router.put('/configuracion', (req, res) => {
    res.status(200).json({ message: 'Actualizar configuración - en desarrollo' });
});

module.exports = router;