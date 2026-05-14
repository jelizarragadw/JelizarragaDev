// src/routes/authRoutes.js
const express = require('express');
const AuthController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

// Rutas públicas
router.post('/login/cliente', AuthController.loginCliente);
router.post('/login/sistema', AuthController.loginSistema);
router.post('/registro', AuthController.registrarCliente);

// Rutas protegidas
router.get('/perfil', authMiddleware, AuthController.getPerfil);
router.put('/cambiar-password', authMiddleware, AuthController.cambiarPassword);
router.post('/logout', authMiddleware, AuthController.logout);  // Nueva ruta

module.exports = router;