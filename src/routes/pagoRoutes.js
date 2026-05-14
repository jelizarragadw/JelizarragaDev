// src/routes/pagoRoutes.js
const express = require('express');
const PagoController = require('../controllers/pagoController');
const { authMiddleware, verificarRol, verificarPropiedadCliente } = require('../middleware/authMiddleware');
const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Cliente puede ver su historial
router.get('/historial', PagoController.historialPagos);
router.get('/:id', verificarPropiedadCliente('id'), PagoController.detallePago);
router.get('/ejecutar-paypal', PagoController.ejecutarPaypal);

// Pagos con PayPal (cliente)
router.post('/crear-orden-paypal', PagoController.crearOrdenPaypal);
router.post('/capturar-paypal', PagoController.capturarPaypal);

// Pagos con transferencia (cliente)
router.post('/subir-comprobante', PagoController.subirComprobante);

// Verificar pago (solo admin)
router.put('/verificar/:id', verificarRol('admin'), PagoController.verificarPago);

module.exports = router;