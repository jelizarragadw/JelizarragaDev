// frontend/js/utils.js

function showAlert(title, message, type = 'success') {
    Swal.fire({
        title: title,
        text: message,
        icon: type,
        confirmButtonColor: '#D4AF37',
        confirmButtonText: 'Aceptar',
        background: '#1A1A1A',
        color: '#FFFFFF'
    });
}

function showLoading() {
    Swal.fire({
        title: 'Cargando...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        },
        background: '#1A1A1A',
        color: '#FFFFFF'
    });
}

function hideLoading() {
    Swal.close();
}

function formatCurrency(amount, currency = 'EUR') {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

async function showConfirm(title, message, confirmText = 'Sí, continuar') {
    const result = await Swal.fire({
        title: title,
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#D4AF37',
        cancelButtonColor: '#dc3545',
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancelar',
        background: '#1A1A1A',
        color: '#FFFFFF'
    });
    return result.isConfirmed;
}