// Funciones de autenticación
async function login(email, password, tipo) {
    const endpoint = tipo === 'cliente' ? '/auth/login/cliente' : '/auth/login/sistema';

    showLoading();

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            setToken(data.data.token);
            setUser(data.data.usuario);

            Swal.fire({
                icon: 'success',
                title: '¡Bienvenido!',
                text: `Hola ${data.data.usuario.nombre}`,
                timer: 1500,
                showConfirmButton: false,
                background: '#1A1A1A',
                color: '#FFFFFF'
            });

            setTimeout(() => {
                const destino = data.data.usuario.rol === 'admin' ? '/dashboard-admin.html' : '/dashboard-cliente.html';
                window.location.href = destino;
            }, 1500);
        } else {
            hideLoading();
            showAlert('Error', data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error', 'Error de conexión con el servidor', 'error');
    }
}

async function register(nombre, email, password, telefono) {
    showLoading();

    try {
        const response = await fetch(`${API_URL}/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_completo: nombre,
                email,
                password,
                telefono
            })
        });

        const data = await response.json();

        if (data.success) {
            hideLoading();
            Swal.fire({
                icon: 'success',
                title: '¡Registro exitoso!',
                text: 'Ahora puedes iniciar sesión',
                timer: 2000,
                showConfirmButton: false,
                background: '#1A1A1A',
                color: '#FFFFFF'
            });
            setTimeout(() => {
                location.reload();
            }, 2000);
        } else {
            hideLoading();
            showAlert('Error', data.message, 'error');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error', 'Error de conexión con el servidor', 'error');
    }
}

async function logout() {
    const result = await Swal.fire({
        title: '¿Cerrar sesión?',
        text: '¿Estás seguro de que quieres salir?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#D4AF37',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar',
        background: '#1A1A1A',
        color: '#FFFFFF'
    });

    if (result.isConfirmed) {
        removeToken();
        Swal.fire({
            icon: 'success',
            title: 'Sesión cerrada',
            text: 'Has salido correctamente',
            timer: 1500,
            showConfirmButton: false,
            background: '#1A1A1A',
            color: '#FFFFFF'
        });
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
    }
}

// ============================================
// FUNCIONES DE TOKEN Y ALMACENAMIENTO
// ============================================

function getToken() {
    return localStorage.getItem('auth_token');
}

function setToken(token) {
    localStorage.setItem('auth_token', token);
}

function removeToken() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
}

function getUser() {
    const userStr = localStorage.getItem('user_data');
    return userStr ? JSON.parse(userStr) : null;
}

function setUser(user) {
    localStorage.setItem('user_data', JSON.stringify(user));
}

function isAuthenticated() {
    return getToken() !== null;
}

function checkAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return false;
    }

    const user = getUser();
    const currentPage = window.location.pathname;

    // Verificar permisos de página
    if (currentPage.includes('admin') && user?.rol !== 'admin') {
        window.location.href = '/dashboard-cliente.html';
        return false;
    }

    if (currentPage.includes('cliente') && user?.rol === 'admin') {
        window.location.href = '/dashboard-admin.html';
        return false;
    }

    return true;
}

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}