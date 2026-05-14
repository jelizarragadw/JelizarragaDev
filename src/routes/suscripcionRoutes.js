// src/routes/suscripcionRoutes.js
const express = require('express');
const SuscripcionController = require('../controllers/suscripcionController');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(authMiddleware);

router.get('/', SuscripcionController.listar);
router.post('/:id/renovar', SuscripcionController.renovar);
router.put('/:id/cancelar', SuscripcionController.cancelar);
router.put('/:id/activar-automatica', SuscripcionController.activarAutomatica);

module.exports = router;