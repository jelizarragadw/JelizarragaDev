// frontend/js/cliente.js

async function cargarDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard/resumen`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            const stats = data.data.estadisticas;
            const financiero = data.data.financiero;

            document.getElementById('proyectosActivos').textContent = stats.proyectos_activos || 0;
            document.getElementById('proyectosCompletados').textContent = stats.proyectos_completados || 0;
            document.getElementById('totalPagado').textContent = formatCurrency(financiero.total_pagado || 0);
            document.getElementById('deudaPendiente').textContent = formatCurrency(financiero.deuda_pendiente || 0);

            // Próximos pagos
            const pagos = data.data.proximos_pagos || [];
            const pagosHtml = pagos.length > 0 ? pagos.map(p => `
                <div class="payment-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--gray);">
                    <div>
                        <strong>${p.nombre_proyecto}</strong>
                        <small style="display: block; color: var(--gold);">${p.nombre_cuota}</small>
                    </div>
                    <div style="text-align: right;">
                        <strong>${formatCurrency(p.monto)}</strong>
                        <small style="display: block; font-size: 11px;">Vence: ${formatDate(p.fecha_limite)}</small>
                    </div>
                </div>
            `).join('') : '<p class="text-center">No hay pagos pendientes</p>';

            document.getElementById('proximosPagosContainer').innerHTML = pagosHtml;

            // Notificaciones
            const notificaciones = data.data.notificaciones_pendientes?.items || [];
            const notifHtml = notificaciones.length > 0 ? notificaciones.map(n => `
                <div class="notification-item" style="padding: 12px 0; border-bottom: 1px solid var(--gray);">
                    <small style="color: var(--gold);">${n.hace}</small>
                    <p style="margin-top: 4px;">${n.mensaje}</p>
                </div>
            `).join('') : '<p class="text-center">No hay notificaciones nuevas</p>';

            document.getElementById('notificacionesContainer').innerHTML = notifHtml;
        }
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

async function cargarProyectos() {
    try {
        const response = await fetch(`${API_URL}/proyectos`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            document.getElementById('proyectosContainer').innerHTML = data.data.map(p => `
                <tr>
                    <td><strong>${p.nombre_proyecto}</strong></td>
                    <td><span class="badge badge-info">${p.estado_proyecto}</span></td>
                    <td>${formatCurrency(p.costo_total)}</td>
                    <td>${formatCurrency(p.total_pagado || 0)}</td>
                    <td><button class="btn-outline" onclick="verProyecto(${p.id})">Ver Detalle</button></td>
                </tr>
            `).join('');
        } else {
            document.getElementById('proyectosContainer').innerHTML = '<tr><td colspan="5" class="text-center">No tienes proyectos aún</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando proyectos:', error);
    }
}

async function cargarPagos() {
    try {
        const response = await fetch(`${API_URL}/pagos/historial`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            document.getElementById('pagosContainer').innerHTML = data.data.map(p => `
                <tr>
                    <td>${p.nombre_proyecto || '-'}</td>
                    <td>${formatCurrency(p.monto)}</td>
                    <td>${p.metodo_pago}</td>
                    <td>${p.fecha_pago ? formatDate(p.fecha_pago) : '-'}</td>
                    <td><span class="badge badge-success">${p.estado_pago}</span></td>
                </tr>
            `).join('');
        } else {
            document.getElementById('pagosContainer').innerHTML = '<tr><td colspan="5" class="text-center">No hay pagos registrados</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando pagos:', error);
    }
}

async function cargarSuscripciones() {
    try {
        const response = await fetch(`${API_URL}/suscripciones`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            document.getElementById('suscripcionesContainer').innerHTML = data.data.map(s => `
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas ${s.tipo_servicio === 'hosting' ? 'fa-server' : s.tipo_servicio === 'dominio' ? 'fa-globe' : 'fa-lock'}"></i> ${s.nombre_servicio}</h3>
                    </div>
                    <div class="card-body">
                        <p><strong>Precio:</strong> ${formatCurrency(s.precio_unitario)}/año</p>
                        <p><strong>Vence:</strong> ${formatDate(s.fecha_expiracion)}</p>
                        <p><strong>Días restantes:</strong> ${s.dias_restantes}</p>
                        <p><strong>Estado:</strong> <span class="badge ${s.dias_restantes <= 7 ? 'badge-danger' : s.dias_restantes <= 30 ? 'badge-warning' : 'badge-success'}">${s.estado_servicio}</span></p>
                        ${s.dias_restantes <= 30 ? `<button class="btn-gold mt-3" onclick="renovarSuscripcion(${s.id})">Renovar Ahora</button>` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            document.getElementById('suscripcionesContainer').innerHTML = '<div class="card"><div class="card-body text-center">No tienes servicios activos</div></div>';
        }
    } catch (error) {
        console.error('Error cargando suscripciones:', error);
    }
}

async function cargarTickets() {
    try {
        const response = await fetch(`${API_URL}/tickets`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            document.getElementById('ticketsContainer').innerHTML = data.data.map(t => `
                <tr>
                    <td>#${t.id}</td>
                    <td>${t.asunto}</td>
                    <td><span class="badge badge-info">${t.estado}</span></td>
                    <td><span class="badge ${t.prioridad === 'alta' ? 'badge-danger' : 'badge-warning'}">${t.prioridad}</span></td>
                    <td>${formatDate(t.fecha_creacion)}</td>
                    <td><button class="btn-outline" onclick="verTicket(${t.id})">Ver</button></td>
                </tr>
            `).join('');
        } else {
            document.getElementById('ticketsContainer').innerHTML = '<tr><td colspan="6" class="text-center">No hay tickets de soporte</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando tickets:', error);
    }
}

async function cargarPerfil() {
    try {
        const response = await fetch(`${API_URL}/auth/perfil`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('perfilContainer').innerHTML = `
                <div class="profile-info">
                    <p><strong><i class="fas fa-user"></i> Nombre:</strong> ${data.data.nombre_completo}</p>
                    <p><strong><i class="fas fa-envelope"></i> Email:</strong> ${data.data.email}</p>
                    <p><strong><i class="fas fa-phone"></i> Teléfono:</strong> ${data.data.telefono || 'No registrado'}</p>
                    <p><strong><i class="fas fa-building"></i> Empresa:</strong> ${data.data.empresa || 'No registrada'}</p>
                    <p><strong><i class="fas fa-calendar-alt"></i> Miembro desde:</strong> ${formatDate(data.data.fecha_registro)}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error cargando perfil:', error);
    }
}

async function nuevoTicket() {
    const { value: form } = await Swal.fire({
        title: 'Nuevo Ticket de Soporte',
        html: `
            <div class="form-group">
                <label class="form-label">Asunto</label>
                <input id="asunto" class="form-control" placeholder="Breve descripción del problema">
            </div>
            <div class="form-group">
                <label class="form-label">Prioridad</label>
                <select id="prioridad" class="form-control">
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Descripción detallada</label>
                <textarea id="descripcion" class="form-control" rows="4" placeholder="Explica detalladamente tu problema..."></textarea>
            </div>
        `,
        confirmButtonText: 'Enviar Ticket',
        confirmButtonColor: '#D4AF37',
        background: '#1A1A1A',
        color: '#FFFFFF',
        preConfirm: () => ({
            asunto: document.getElementById('asunto').value,
            prioridad: document.getElementById('prioridad').value,
            descripcion: document.getElementById('descripcion').value
        })
    });

    if (form && form.asunto && form.descripcion) {
        try {
            const response = await fetch(`${API_URL}/tickets`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    asunto: form.asunto,
                    prioridad: form.prioridad,
                    descripcion: form.descripcion
                })
            });

            const data = await response.json();

            if (data.success) {
                showAlert('Ticket Creado', 'Tu ticket ha sido enviado exitosamente', 'success');
                cargarTickets();
            } else {
                showAlert('Error', data.message, 'error');
            }
        } catch (error) {
            showAlert('Error', 'Error al crear el ticket', 'error');
        }
    }
}

async function verTicket(id) {
    try {
        const response = await fetch(`${API_URL}/tickets/${id}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: `Ticket #${data.data.ticket.id}`,
                html: `
                    <div style="text-align: left;">
                        <p><strong>Asunto:</strong> ${data.data.ticket.asunto}</p>
                        <p><strong>Estado:</strong> ${data.data.ticket.estado}</p>
                        <p><strong>Prioridad:</strong> ${data.data.ticket.prioridad}</p>
                        <p><strong>Descripción:</strong> ${data.data.ticket.descripcion}</p>
                        <hr>
                        <h4>Respuestas:</h4>
                        ${data.data.respuestas.map(r => `
                            <div style="background: #2A2A2A; padding: 10px; border-radius: 8px; margin-top: 10px;">
                                <small><strong>${r.autor_nombre}</strong> - ${formatDate(r.fecha_respuesta)}</small>
                                <p style="margin-top: 8px;">${r.mensaje}</p>
                            </div>
                        `).join('') || '<p>No hay respuestas aún</p>'}
                        <hr>
                        <textarea id="respuestaTexto" class="form-control" placeholder="Escribe tu respuesta..."></textarea>
                    </div>
                `,
                width: '600px',
                confirmButtonText: 'Responder',
                confirmButtonColor: '#D4AF37',
                showCancelButton: true,
                cancelButtonText: 'Cerrar',
                background: '#1A1A1A',
                color: '#FFFFFF',
                preConfirm: async () => {
                    const mensaje = document.getElementById('respuestaTexto').value;
                    if (mensaje) {
                        await responderTicket(id, mensaje);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error al ver ticket:', error);
    }
}

async function responderTicket(id, mensaje) {
    try {
        const response = await fetch(`${API_URL}/tickets/${id}/responder`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ mensaje })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Respuesta Enviada', 'Tu respuesta ha sido registrada', 'success');
            cargarTickets();
        } else {
            showAlert('Error', data.message, 'error');
        }
    } catch (error) {
        showAlert('Error', 'Error al enviar respuesta', 'error');
    }
}

async function renovarSuscripcion(id) {
    const confirm = await showConfirm('Renovar Servicio', '¿Deseas renovar este servicio por un año más?');

    if (confirm) {
        showAlert('Renovación', 'Funcionalidad en desarrollo', 'info');
    }
}

async function verProyecto(id) {
    try {
        const response = await fetch(`${API_URL}/proyectos/${id}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: data.data.nombre_proyecto,
                html: `
                    <div style="text-align: left;">
                        <p>${data.data.descripcion || 'Sin descripción'}</p>
                        <p><strong>Estado:</strong> ${data.data.estado_proyecto}</p>
                        <p><strong>Costo Total:</strong> ${formatCurrency(data.data.costo_total)}</p>
                        <p><strong>Pagado:</strong> ${formatCurrency(data.data.resumen_financiero?.total_pagado || 0)}</p>
                        <p><strong>Pendiente:</strong> ${formatCurrency(data.data.resumen_financiero?.saldo_pendiente || 0)}</p>
                        <hr>
                        <h4>Plan de Pagos</h4>
                        ${(data.data.planes_pago || []).map(pp => `
                            <div style="background: #2A2A2A; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
                                <strong>${pp.nombre_cuota}</strong><br>
                                Monto: ${formatCurrency(pp.monto)}<br>
                                Fecha: ${formatDate(pp.fecha_limite)}<br>
                                Estado: ${pp.estado_cuota}
                            </div>
                        `).join('')}
                    </div>
                `,
                width: '600px',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#D4AF37',
                background: '#1A1A1A',
                color: '#FFFFFF'
            });
        }
    } catch (error) {
        console.error('Error al ver proyecto:', error);
    }
}

async function cambiarPassword(actual, nueva) {
    try {
        const response = await fetch(`${API_URL}/auth/cambiar-password`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                password_actual: actual,
                password_nueva: nueva
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Éxito', 'Contraseña actualizada correctamente', 'success');
            document.getElementById('passwordActual').value = '';
            document.getElementById('passwordNueva').value = '';
            document.getElementById('passwordConfirm').value = '';
        } else {
            showAlert('Error', data.message, 'error');
        }
    } catch (error) {
        showAlert('Error', 'Error al cambiar la contraseña', 'error');
    }
}