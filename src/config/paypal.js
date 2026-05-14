// src/config/paypal.js
const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');

// Configurar el entorno (Sandbox para pruebas, Live para producción)
function environment() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_SECRET;

    if (process.env.PAYPAL_MODE === 'live') {
        return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
    } else {
        return new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
    }
}

function client() {
    return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
}

module.exports = { client };