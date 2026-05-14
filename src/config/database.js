// src/config/database.js
const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Promisify para usar async/await
const promisePool = pool.promise();

// Función de prueba de conexión
const testConnection = async () => {
    try {
        const [rows] = await promisePool.query('SELECT 1');
        console.log('MySQL Connected Succesfully!');
        return true;
    } catch (error) {
        console.error(error.message);
        return false;
    }
};

module.exports = { pool: promisePool, testConnection };