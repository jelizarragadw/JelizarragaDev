// frontend/js/config.js
const API_URL = 'http://localhost:3000/api';

// Configuración de la aplicación
const AppConfig = {
    apiUrl: API_URL,
    tokenKey: 'auth_token',
    userKey: 'user_data'
};

// Obtener token almacenado
function getToken() {
    return localStorage.getItem(AppConfig.tokenKey);
}

// Guardar token
function setToken(token) {
    localStorage.setItem(AppConfig.tokenKey, token);
}

// Eliminar token
function removeToken() {
    localStorage.removeItem(AppConfig.tokenKey);
    localStorage.removeItem(AppConfig.userKey);
}

// Obtener usuario almacenado
function getUser() {
    const userStr = localStorage.getItem(AppConfig.userKey);
    return userStr ? JSON.parse(userStr) : null;
}

// Guardar usuario
function setUser(user) {
    localStorage.setItem(AppConfig.userKey, JSON.stringify(user));
}

// Verificar si está autenticado
function isAuthenticated() {
    return getToken() !== null;
}

// Headers para peticiones autenticadas
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}