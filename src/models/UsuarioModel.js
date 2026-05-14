// src/models/UsuarioModel.js
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class UsuarioModel {
    static async findByEmail(email) {
        const [rows] = await pool.query(
            'SELECT * FROM usuarios_sistema WHERE email = ?',
            [email]
        );
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await pool.query(
            'SELECT id, nombre_usuario, email, rol, permisos, activo, ultimo_login FROM usuarios_sistema WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    static async cambiarPassword(id, nuevaPassword) {
        const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
        const [result] = await pool.query(
            'UPDATE usuarios_sistema SET password_hash = ? WHERE id = ?',
            [hashedPassword, id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = UsuarioModel;