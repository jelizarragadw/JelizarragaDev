DROP DATABASE IF EXISTS sistema_gestion_desarrollador;

-- Crear base de datos
CREATE DATABASE sistema_gestion_desarrollador
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- Usar la base de datos
USE sistema_gestion_desarrollador;

-- ==============================================
-- 1. TABLAS PRINCIPALES
-- ==============================================

-- Clientes
CREATE TABLE clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    codigo_cliente VARCHAR(20) UNIQUE,
    tipo_documento ENUM('DNI', 'NIE', 'PASAPORTE', 'RUC', 'OTRO') DEFAULT 'DNI',
    documento VARCHAR(20),
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    telefono_alternativo VARCHAR(20),
    direccion TEXT,
    ciudad VARCHAR(50),
    pais VARCHAR(50) DEFAULT 'España',
    empresa VARCHAR(100),
    puesto_empresa VARCHAR(100),
    como_conocio ENUM('google', 'referido', 'redes', 'antiguo', 'otro') DEFAULT 'otro',
    notas TEXT,
    estado_cliente ENUM('activo', 'inactivo', 'moroso', 'bloqueado') DEFAULT 'activo',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_estado (estado_cliente),
    INDEX idx_codigo (codigo_cliente)
);

-- Usuarios del sistema
CREATE TABLE usuarios_sistema (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_usuario VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'desarrollador', 'soporte', 'contador') DEFAULT 'desarrollador',
    permisos JSON,
    activo BOOLEAN DEFAULT TRUE,
    ultimo_login TIMESTAMP NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_activo (activo)
);

-- Acceso para clientes
CREATE TABLE usuario_acceso (
    cliente_id INT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    token_recuperacion VARCHAR(64) NULL,
    token_expiracion TIMESTAMP NULL,
    intentos_fallidos INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP NULL,
    ultimo_cambio_password TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    two_factor_secret VARCHAR(255) NULL,
    two_factor_habilitado BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    INDEX idx_email (email)
);

-- Catálogo de servicios
CREATE TABLE catalogo_servicios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_servicio VARCHAR(100) NOT NULL,
    tipo_servicio ENUM('web', 'app_movil', 'app_escritorio', 'api', 'soporte', 'consultoria', 'hosting', 'dominio', 'ssl') NOT NULL,
    descripcion TEXT,
    precio_base DECIMAL(12,2),
    unidad_medida ENUM('unidad', 'hora', 'mes', 'año') DEFAULT 'unidad',
    iva_aplicable BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE,
    INDEX idx_tipo (tipo_servicio)
);

-- Proyectos
CREATE TABLE proyectos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    nombre_proyecto VARCHAR(150) NOT NULL,
    descripcion TEXT,
    tipo_proyecto ENUM('web', 'app_movil', 'app_escritorio', 'api', 'soporte', 'consultoria') NOT NULL,
    url_proyecto VARCHAR(255),
    estado_proyecto ENUM('cotizacion', 'aprobado', 'en_desarrollo', 'pausado', 'revision', 'entregado', 'soporte', 'cancelado') DEFAULT 'cotizacion',
    prioridad ENUM('baja', 'media', 'alta', 'urgente') DEFAULT 'media',
    fecha_inicio DATE,
    fecha_entrega_pactada DATE,
    fecha_entrega_real DATE,
    horas_estimadas INT,
    horas_trabajadas INT DEFAULT 0,
    costo_total DECIMAL(12,2),
    moneda ENUM('EUR', 'USD', 'MXN') DEFAULT 'EUR',
    incluye_hosting BOOLEAN DEFAULT FALSE,
    incluye_dominio BOOLEAN DEFAULT FALSE,
    incluye_ssl BOOLEAN DEFAULT FALSE,
    renovacion_automatica BOOLEAN DEFAULT FALSE,
    notas_internas TEXT,
    cliente_visible BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    INDEX idx_estado (estado_proyecto),
    INDEX idx_cliente (cliente_id),
    INDEX idx_tipo (tipo_proyecto)
);

-- ==============================================
-- 2. PLANES DE PAGO
-- ==============================================

CREATE TABLE planes_pago (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proyecto_id INT NOT NULL,
    numero_cuota INT NOT NULL,
    nombre_cuota VARCHAR(100),
    descripcion TEXT,
    porcentaje DECIMAL(5,2),
    monto DECIMAL(12,2),
    fecha_limite DATE NOT NULL,
    fecha_recordatorio_enviado DATE NULL,
    estado_cuota ENUM('pendiente', 'pagado_parcial', 'pagado_total', 'vencido', 'cancelado') DEFAULT 'pendiente',
    orden_pago INT DEFAULT 0,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    INDEX idx_estado_cuota (estado_cuota),
    INDEX idx_fecha_limite (fecha_limite),
    INDEX idx_proyecto (proyecto_id)
);

-- ==============================================
-- 3. PAGOS Y TRANSACCIONES
-- ==============================================

CREATE TABLE pagos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    proyecto_id INT,
    plan_pago_id INT,
    uuid_transaccion VARCHAR(36) UNIQUE NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    moneda CHAR(3) DEFAULT 'EUR',
    metodo_pago ENUM('transferencia', 'efectivo', 'tarjeta', 'paypal', 'stripe', 'mercadopago') NOT NULL,
    estado_pago ENUM('iniciado', 'pendiente_verificacion', 'completado', 'fallido', 'reembolsado', 'disputa') DEFAULT 'iniciado',
    fecha_pago TIMESTAMP NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comprobante_url VARCHAR(500),
    notas_pago TEXT,
    verificado_por INT,
    fecha_verificacion TIMESTAMP NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL,
    FOREIGN KEY (plan_pago_id) REFERENCES planes_pago(id) ON DELETE SET NULL,
    FOREIGN KEY (verificado_por) REFERENCES usuarios_sistema(id),
    INDEX idx_cliente (cliente_id),
    INDEX idx_estado (estado_pago),
    INDEX idx_uuid (uuid_transaccion)
);

CREATE TABLE transacciones_paypal (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pago_id INT NOT NULL UNIQUE,
    paypal_order_id VARCHAR(100) NOT NULL,
    paypal_payer_id VARCHAR(100),
    paypal_payment_id VARCHAR(100),
    paypal_facilitator_access_token VARCHAR(255),
    paypal_transaction_id VARCHAR(100) UNIQUE,
    paypal_status VARCHAR(50),
    payer_email VARCHAR(100),
    payer_name VARCHAR(150),
    payer_country_code VARCHAR(2),
    paypal_fee DECIMAL(10,2),
    net_amount DECIMAL(10,2),
    currency_code CHAR(3),
    capture_id VARCHAR(100),
    capture_status VARCHAR(50),
    capture_date TIMESTAMP,
    refund_id VARCHAR(100),
    refund_amount DECIMAL(10,2),
    -- refund_date TIMESTAMP,
    webhook_event_id VARCHAR(100),
    raw_response JSON,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE,
    INDEX idx_paypal_order (paypal_order_id),
    INDEX idx_paypal_transaction (paypal_transaction_id)
);

CREATE TABLE transacciones_tarjeta (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pago_id INT NOT NULL UNIQUE,
    gateway ENUM('stripe', 'mercadopago', 'redsys') NOT NULL,
    gateway_transaction_id VARCHAR(100) UNIQUE NOT NULL,
    gateway_customer_id VARCHAR(100),
    card_last4 VARCHAR(4),
    card_brand VARCHAR(20),
    card_exp_month VARCHAR(2),
    card_exp_year VARCHAR(4),
    authorization_code VARCHAR(100),
    gateway_status VARCHAR(50),
    gateway_response JSON,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE
);

CREATE TABLE transacciones_transferencia (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pago_id INT NOT NULL UNIQUE,
    banco_origen VARCHAR(100),
    cuenta_origen VARCHAR(50),
    titular_origen VARCHAR(150),
    banco_destino VARCHAR(100),
    numero_referencia VARCHAR(100),
    fecha_transferencia DATE,
    comprobante_subido VARCHAR(500),
    verificado BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE
);

-- ==============================================
-- 4. SERVICIOS RECURRENTES (Hosting, Dominio, SSL)
-- ==============================================

CREATE TABLE suscripciones_recurrentes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    proyecto_id INT NULL,
    tipo_servicio ENUM('hosting', 'dominio', 'ssl', 'soporte_mensual', 'mantenimiento') NOT NULL,
    nombre_servicio VARCHAR(150) NOT NULL,
    descripcion TEXT,
    ciclo_facturacion ENUM('mensual', 'trimestral', 'semestral', 'anual', 'bienal') DEFAULT 'anual',
    precio_unitario DECIMAL(10,2) NOT NULL,
    moneda CHAR(3) DEFAULT 'EUR',
    iva_aplicable BOOLEAN DEFAULT TRUE,
    fecha_inicio DATE NOT NULL,
    fecha_proxima_facturacion DATE NOT NULL,
    fecha_expiracion DATE NOT NULL,
    dias_aviso_previo INT DEFAULT 30,
    estado ENUM('activo', 'suspendido', 'cancelado', 'expirado') DEFAULT 'activo',
    renovacion_automatica BOOLEAN DEFAULT FALSE,
    notificacion_envio_automatico BOOLEAN DEFAULT TRUE,
    proveedor_servicio VARCHAR(100),
    referencia_proveedor VARCHAR(200),
    credenciales_acceso JSON,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL,
    INDEX idx_proxima_facturacion (fecha_proxima_facturacion),
    INDEX idx_estado (estado),
    INDEX idx_cliente (cliente_id)
);

CREATE TABLE historial_renovaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suscripcion_id INT NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    monto_pagado DECIMAL(10,2),
    pago_id INT NULL,
    fecha_renovacion DATE NOT NULL,
    metodo_renovacion ENUM('automatica', 'manual', 'fallida') DEFAULT 'manual',
    notas TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (suscripcion_id) REFERENCES suscripciones_recurrentes(id) ON DELETE CASCADE,
    FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE SET NULL,
    INDEX idx_suscripcion (suscripcion_id)
);

CREATE TABLE recordatorios_programados (
    id INT PRIMARY KEY AUTO_INCREMENT,
    suscripcion_id INT NOT NULL,
    tipo_recordatorio ENUM('vencimiento', 'pago_pendiente', 'servicio_expirado', 'renovacion_exitosa') NOT NULL,
    dias_anticipacion INT NOT NULL,
    fecha_programada DATE NOT NULL,
    fecha_envio TIMESTAMP NULL,
    enviado BOOLEAN DEFAULT FALSE,
    canal_envio ENUM('email', 'whatsapp', 'sms', 'sistema') DEFAULT 'email',
    mensaje_enviado TEXT,
    error_envio TEXT,
    FOREIGN KEY (suscripcion_id) REFERENCES suscripciones_recurrentes(id) ON DELETE CASCADE,
    INDEX idx_pendientes (fecha_programada, enviado),
    INDEX idx_suscripcion (suscripcion_id)
);

CREATE TABLE preferencias_alertas_clientes (
    cliente_id INT PRIMARY KEY,
    recordatorio_dias_anticipacion JSON DEFAULT '[30, 15, 7, 3, 1]',
    notificar_email BOOLEAN DEFAULT TRUE,
    notificar_whatsapp BOOLEAN DEFAULT FALSE,
    notificar_sms BOOLEAN DEFAULT FALSE,
    horario_preferido TIME NULL,
    ultima_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- ==============================================
-- 5. COBROS EXTRA
-- ==============================================

CREATE TABLE categorias_cargos_extra (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_categoria VARCHAR(100) NOT NULL,
    descripcion TEXT,
    porcentaje_mora DECIMAL(5,2) DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE cargos_extra (
    id INT PRIMARY KEY AUTO_INCREMENT,
    proyecto_id INT NOT NULL,
    categoria_id INT,
    motivo VARCHAR(200) NOT NULL,
    descripcion_detallada TEXT,
    monto_base DECIMAL(12,2) NOT NULL,
    iva DECIMAL(12,2) DEFAULT 0,
    monto_total DECIMAL(12,2) NOT NULL,
    fecha_cargo DATE NOT NULL,
    fecha_limite_pago DATE,
    estado ENUM('pendiente', 'pagado', 'cancelado', 'facturado') DEFAULT 'pendiente',
    pago_id INT NULL,
    creado_por INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
    FOREIGN KEY (categoria_id) REFERENCES categorias_cargos_extra(id),
    FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE SET NULL,
    FOREIGN KEY (creado_por) REFERENCES usuarios_sistema(id),
    INDEX idx_estado (estado),
    INDEX idx_proyecto (proyecto_id)
);

-- ==============================================
-- 6. NOTIFICACIONES Y LOGS
-- ==============================================

CREATE TABLE notificaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NULL,
    usuario_sistema_id INT NULL,
    tipo_notificacion ENUM('pago_vencido', 'pago_recibido', 'recordatorio', 'proyecto_actualizado', 'soporte', 'sistema') NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    url_enlace VARCHAR(500),
    leido BOOLEAN DEFAULT FALSE,
    leido_en TIMESTAMP NULL,
    enviado_email BOOLEAN DEFAULT FALSE,
    enviado_whatsapp BOOLEAN DEFAULT FALSE,
    fecha_envio TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usuario (usuario_id),
    INDEX idx_leido (leido)
);

CREATE TABLE plantillas_notificaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_plantilla VARCHAR(100) UNIQUE NOT NULL,
    asunto VARCHAR(200) NOT NULL,
    cuerpo_html TEXT NOT NULL,
    cuerpo_texto TEXT,
    variables_disponibles JSON,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE logs_actividad_clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    accion VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    detalles JSON,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    INDEX idx_cliente_fecha (cliente_id, fecha_hora)
);

CREATE TABLE logs_actividad_sistema (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_sistema_id INT NOT NULL,
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(50),
    registro_id INT,
    valores_anteriores JSON,
    valores_nuevos JSON,
    ip_address VARCHAR(45),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_sistema_id) REFERENCES usuarios_sistema(id),
    INDEX idx_usuario_fecha (usuario_sistema_id, fecha_hora)
);

CREATE TABLE logs_pagos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pago_id INT NOT NULL,
    estado_anterior ENUM('iniciado', 'pendiente_verificacion', 'completado', 'fallido', 'reembolsado'),
    estado_nuevo ENUM('iniciado', 'pendiente_verificacion', 'completado', 'fallido', 'reembolsado'),
    motivo_cambio VARCHAR(200),
    realizado_por INT,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pago_id) REFERENCES pagos(id),
    INDEX idx_pago (pago_id)
);

-- ==============================================
-- 7. SOPORTE
-- ==============================================

CREATE TABLE tickets_soporte (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    proyecto_id INT NULL,
    asunto VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    prioridad ENUM('baja', 'media', 'alta', 'critica') DEFAULT 'media',
    estado ENUM('abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado') DEFAULT 'abierto',
    categoria ENUM('tecnico', 'facturacion', 'consulta', 'urgente') DEFAULT 'consulta',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL,
    INDEX idx_estado (estado),
    INDEX idx_cliente (cliente_id)
);

CREATE TABLE respuestas_tickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    usuario_sistema_id INT NULL,
    cliente_id INT NULL,
    mensaje TEXT NOT NULL,
    archivo_adjunto VARCHAR(500),
    fecha_respuesta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets_soporte(id) ON DELETE CASCADE,
    INDEX idx_ticket (ticket_id)
);

-- ==============================================
-- 8. FACTURACIÓN
-- ==============================================

CREATE TABLE facturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cliente_id INT NOT NULL,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    tipo_factura ENUM('factura', 'recibo', 'presupuesto', 'abono') DEFAULT 'factura',
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    subtotal DECIMAL(12,2),
    iva DECIMAL(12,2),
    total DECIMAL(12,2) NOT NULL,
    pdf_url VARCHAR(500),
    xml_url VARCHAR(500),
    estado ENUM('emitida', 'pagada', 'vencida', 'anulada') DEFAULT 'emitida',
    serie VARCHAR(10),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    INDEX idx_numero (numero_factura),
    INDEX idx_cliente (cliente_id)
);

CREATE TABLE factura_pagos (
    factura_id INT NOT NULL,
    pago_id INT NOT NULL,
    monto_aplicado DECIMAL(12,2),
    fecha_aplicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (factura_id, pago_id),
    FOREIGN KEY (factura_id) REFERENCES facturas(id),
    FOREIGN KEY (pago_id) REFERENCES pagos(id)
);

-- ==============================================
-- 9. CONFIGURACIÓN
-- ==============================================

CREATE TABLE configuracion_empresa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    tipo_dato ENUM('string', 'int', 'boolean', 'json', 'decimal') DEFAULT 'string',
    descripcion TEXT,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==============================================
-- 10. VISTAS
-- ==============================================

CREATE VIEW vista_pagos_pendientes AS
SELECT 
    c.id AS cliente_id,
    c.nombre_completo,
    c.email,
    p.nombre_proyecto,
    pp.numero_cuota,
    pp.nombre_cuota,
    pp.monto,
    pp.fecha_limite,
    DATEDIFF(CURDATE(), pp.fecha_limite) AS dias_atraso,
    CASE 
        WHEN pp.fecha_limite < CURDATE() THEN 'Vencido'
        WHEN pp.fecha_limite <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'Próximo'
        ELSE 'Futuro'
    END AS estado_alerta
FROM planes_pago pp
JOIN proyectos p ON pp.proyecto_id = p.id
JOIN clientes c ON p.cliente_id = c.id
WHERE pp.estado_cuota IN ('pendiente', 'vencido')
ORDER BY pp.fecha_limite ASC;

CREATE VIEW vista_proximas_renovaciones AS
SELECT 
    s.id AS suscripcion_id,
    c.id AS cliente_id,
    c.nombre_completo,
    c.email,
    s.nombre_servicio,
    s.tipo_servicio,
    s.precio_unitario,
    s.moneda,
    s.fecha_proxima_facturacion,
    s.fecha_expiracion,
    DATEDIFF(s.fecha_proxima_facturacion, CURDATE()) AS dias_restantes,
    CASE 
        WHEN DATEDIFF(s.fecha_proxima_facturacion, CURDATE()) <= 0 THEN 'Vencido'
        WHEN DATEDIFF(s.fecha_proxima_facturacion, CURDATE()) <= 7 THEN 'Urgente'
        WHEN DATEDIFF(s.fecha_proxima_facturacion, CURDATE()) <= 15 THEN 'Próximo'
        ELSE 'Normal'
    END AS estado_alerta,
    s.renovacion_automatica,
    s.estado
FROM suscripciones_recurrentes s
JOIN clientes c ON s.cliente_id = c.id
WHERE s.estado = 'activo'
ORDER BY s.fecha_proxima_facturacion ASC;

CREATE VIEW vista_resumen_mensual AS
SELECT 
    DATE_FORMAT(fecha_pago, '%Y-%m') AS mes,
    COUNT(*) AS total_pagos,
    SUM(monto) AS monto_total,
    metodo_pago,
    estado_pago
FROM pagos
WHERE estado_pago = 'completado'
AND fecha_pago IS NOT NULL
GROUP BY mes, metodo_pago, estado_pago;

-- ==============================================
-- 11. TRIGGERS
-- ==============================================

DELIMITER //

CREATE TRIGGER actualizar_estado_cuota
AFTER INSERT ON pagos
FOR EACH ROW
BEGIN
    IF NEW.plan_pago_id IS NOT NULL AND NEW.estado_pago = 'completado' THEN
        UPDATE planes_pago 
        SET estado_cuota = 'pagado_total'
        WHERE id = NEW.plan_pago_id;
        
        UPDATE proyectos p
        SET estado_proyecto = 'entregado'
        WHERE p.id = NEW.proyecto_id
        AND NOT EXISTS (
            SELECT 1 FROM planes_pago pp
            WHERE pp.proyecto_id = p.id
            AND pp.estado_cuota NOT IN ('pagado_total', 'cancelado')
        );
    END IF;
END//

CREATE TRIGGER log_cambios_pagos
AFTER UPDATE ON pagos
FOR EACH ROW
BEGIN
    IF OLD.estado_pago != NEW.estado_pago THEN
        INSERT INTO logs_pagos (pago_id, estado_anterior, estado_nuevo, fecha_cambio)
        VALUES (NEW.id, OLD.estado_pago, NEW.estado_pago, NOW());
    END IF;
END//

CREATE TRIGGER after_insert_suscripcion
AFTER INSERT ON suscripciones_recurrentes
FOR EACH ROW
BEGIN
    DECLARE v_dias INT DEFAULT 0;
    DECLARE v_contador INT DEFAULT 1;
    DECLARE v_dias_array JSON;
    
    SET v_dias_array = COALESCE(
        (SELECT recordatorio_dias_anticipacion FROM preferencias_alertas_clientes WHERE cliente_id = NEW.cliente_id),
        '[30, 15, 7, 3, 1]'
    );
    
    WHILE v_contador <= JSON_LENGTH(v_dias_array) DO
        SET v_dias = JSON_EXTRACT(v_dias_array, CONCAT('$[', v_contador - 1, ']'));
        
        INSERT INTO recordatorios_programados (
            suscripcion_id,
            tipo_recordatorio,
            dias_anticipacion,
            fecha_programada,
            enviado
        ) VALUES (
            NEW.id,
            'vencimiento',
            v_dias,
            DATE_SUB(NEW.fecha_proxima_facturacion, INTERVAL v_dias DAY),
            FALSE
        );
        
        SET v_contador = v_contador + 1;
    END WHILE;
END//

CREATE TRIGGER generate_uuid_clientes
BEFORE INSERT ON clientes
FOR EACH ROW
BEGIN
    IF NEW.uuid IS NULL THEN
        SET NEW.uuid = UUID();
    END IF;
    IF NEW.codigo_cliente IS NULL THEN
        SET NEW.codigo_cliente = CONCAT('CL-', DATE_FORMAT(NOW(), '%Y%m'), '-', LPAD(FLOOR(RAND() * 10000), 4, '0'));
    END IF;
END//

CREATE TRIGGER generate_uuid_pagos
BEFORE INSERT ON pagos
FOR EACH ROW
BEGIN
    IF NEW.uuid_transaccion IS NULL THEN
        SET NEW.uuid_transaccion = UUID();
    END IF;
END//

DELIMITER ;

-- ==============================================
-- 12. PROCEDIMIENTOS ALMACENADOS
-- ==============================================

-- ==============================================
-- 12. PROCEDIMIENTOS ALMACENADOS CORREGIDOS
-- ==============================================

DELIMITER //

-- Procedimiento: Generar recordatorios de próximos vencimientos (versión corregida)
CREATE PROCEDURE generar_recordatorios_vencimiento()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_suscripcion_id INT;
    DECLARE v_cliente_id INT;
    DECLARE v_email VARCHAR(100);
    DECLARE v_nombre_cliente VARCHAR(150);
    DECLARE v_servicio VARCHAR(150);
    DECLARE v_fecha_vencimiento DATE;
    DECLARE v_dias_restantes INT;
    DECLARE v_preferencias VARCHAR(500);
    DECLARE v_dia_buscar INT;
    DECLARE v_contador INT;
    DECLARE v_encontrado BOOLEAN DEFAULT FALSE;
    
    DECLARE cur_suscripciones CURSOR FOR
        SELECT 
            s.id,
            s.cliente_id,
            c.email,
            c.nombre_completo,
            s.nombre_servicio,
            s.fecha_proxima_facturacion,
            DATEDIFF(s.fecha_proxima_facturacion, CURDATE()) AS dias_restantes,
            COALESCE(pac.recordatorio_dias_anticipacion, '[30,15,7,3,1]') AS preferencias
        FROM suscripciones_recurrentes s
        JOIN clientes c ON s.cliente_id = c.id
        LEFT JOIN preferencias_alertas_clientes pac ON pac.cliente_id = c.id
        WHERE s.estado = 'activo'
        AND s.fecha_proxima_facturacion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
        AND s.notificacion_envio_automatico = TRUE;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur_suscripciones;
    
    read_loop: LOOP
        FETCH cur_suscripciones INTO v_suscripcion_id, v_cliente_id, v_email, v_nombre_cliente, 
                                     v_servicio, v_fecha_vencimiento, v_dias_restantes, v_preferencias;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Verificar si los días restantes están en las preferencias
        SET v_encontrado = FALSE;
        SET v_contador = 1;
        
        WHILE v_contador <= 5 AND v_encontrado = FALSE DO
            SET v_dia_buscar = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(v_preferencias, ',', v_contador), ',', -1) AS UNSIGNED);
            
            -- Limpiar corchetes si existen
            IF v_contador = 1 THEN
                SET v_dia_buscar = CAST(REPLACE(REPLACE(v_dia_buscar, '[', ''), ']', '') AS UNSIGNED);
            END IF;
            
            IF v_dia_buscar = v_dias_restantes THEN
                SET v_encontrado = TRUE;
            END IF;
            
            SET v_contador = v_contador + 1;
        END WHILE;
        
        IF v_encontrado = TRUE THEN
            IF NOT EXISTS (
                SELECT 1 FROM recordatorios_programados
                WHERE suscripcion_id = v_suscripcion_id
                AND dias_anticipacion = v_dias_restantes
                AND DATE(fecha_programada) = CURDATE()
            ) THEN
                INSERT INTO recordatorios_programados (
                    suscripcion_id, 
                    tipo_recordatorio, 
                    dias_anticipacion, 
                    fecha_programada, 
                    enviado
                ) VALUES (
                    v_suscripcion_id,
                    'vencimiento',
                    v_dias_restantes,
                    CURDATE(),
                    FALSE
                );
            END IF;
        END IF;
    END LOOP;
    
    CLOSE cur_suscripciones;
END//

-- Procedimiento: Enviar recordatorios pendientes (versión corregida)
CREATE PROCEDURE enviar_recordatorios_pendientes()
BEGIN
    DECLARE v_id INT;
    DECLARE v_email VARCHAR(100);
    DECLARE v_nombre VARCHAR(150);
    DECLARE v_servicio VARCHAR(150);
    DECLARE v_fecha_vencimiento DATE;
    DECLARE v_dias INT;
    DECLARE v_mensaje TEXT;
    DECLARE v_cliente_id INT;
    DECLARE v_fecha_formateada VARCHAR(20);
    
    DECLARE done INT DEFAULT FALSE;
    
    DECLARE cur_recordatorios CURSOR FOR
        SELECT 
            r.id,
            c.email,
            c.nombre_completo,
            s.nombre_servicio,
            s.fecha_proxima_facturacion,
            r.dias_anticipacion,
            c.id AS cliente_id
        FROM recordatorios_programados r
        JOIN suscripciones_recurrentes s ON r.suscripcion_id = s.id
        JOIN clientes c ON s.cliente_id = c.id
        WHERE r.enviado = FALSE 
        AND r.fecha_programada <= CURDATE()
        LIMIT 100;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur_recordatorios;
    
    read_loop: LOOP
        FETCH cur_recordatorios INTO v_id, v_email, v_nombre, v_servicio, v_fecha_vencimiento, v_dias, v_cliente_id;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Formatear fecha
        SET v_fecha_formateada = DATE_FORMAT(v_fecha_vencimiento, '%d/%m/%Y');
        
        -- Construir mensaje
        SET v_mensaje = CONCAT(
            'Hola ', v_nombre, ', ',
            'tu servicio "', v_servicio, '" vence el ', v_fecha_formateada, '. ',
            'Te quedan ', CAST(v_dias AS CHAR), ' días para renovar.'
        );
        
        -- Marcar como enviado
        UPDATE recordatorios_programados 
        SET enviado = TRUE, 
            fecha_envio = NOW(),
            mensaje_enviado = v_mensaje
        WHERE id = v_id;
        
        -- Crear notificación en el sistema
        INSERT INTO notificaciones (
            usuario_id, 
            tipo_notificacion, 
            titulo, 
            mensaje, 
            url_enlace,
            fecha_envio
        ) VALUES (
            v_cliente_id,
            'recordatorio',
            CONCAT('⚠️ Tu servicio ', v_servicio, ' está por vencer'),
            CONCAT('Te quedan ', CAST(v_dias AS CHAR), ' días para renovar tu ', v_servicio, '. Realiza el pago a tiempo.'),
            '/mis-suscripciones',
            NOW()
        );
    END LOOP;
    
    CLOSE cur_recordatorios;
END//

-- Procedimiento adicional: Actualizar estado de suscripciones vencidas
CREATE PROCEDURE actualizar_suscripciones_vencidas()
BEGIN
    UPDATE suscripciones_recurrentes 
    SET estado = 'expirado'
    WHERE fecha_expiracion < CURDATE() 
    AND estado = 'activo';
    
    -- Crear notificaciones para suscripciones recién vencidas
    INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje, fecha_envio)
    SELECT 
        s.cliente_id,
        'sistema',
        '❌ Servicio expirado',
        CONCAT('Tu servicio "', s.nombre_servicio, '" ha expirado. Renueva para evitar interrupciones.'),
        NOW()
    FROM suscripciones_recurrentes s
    WHERE s.fecha_expiracion = CURDATE() 
    AND s.estado = 'expirado';
END//

-- Procedimiento: Generar automáticamente factura por pago completado
CREATE PROCEDURE generar_factura_por_pago(IN p_pago_id INT)
BEGIN
    DECLARE v_cliente_id INT;
    DECLARE v_monto DECIMAL(12,2);
    DECLARE v_moneda CHAR(3);
    DECLARE v_numero_factura VARCHAR(50);
    DECLARE v_iva_porcentaje DECIMAL(5,2);
    DECLARE v_subtotal DECIMAL(12,2);
    DECLARE v_iva DECIMAL(12,2);
    
    -- Obtener datos del pago
    SELECT cliente_id, monto, moneda INTO v_cliente_id, v_monto, v_moneda
    FROM pagos WHERE id = p_pago_id AND estado_pago = 'completado';
    
    -- Obtener porcentaje de IVA
    SELECT CAST(valor AS DECIMAL(5,2)) INTO v_iva_porcentaje
    FROM configuracion_empresa WHERE clave = 'iva_porcentaje';
    
    IF v_iva_porcentaje IS NULL THEN
        SET v_iva_porcentaje = 21;
    END IF;
    
    -- Calcular subtotal e IVA
    SET v_subtotal = v_monto / (1 + (v_iva_porcentaje / 100));
    SET v_iva = v_monto - v_subtotal;
    
    -- Generar número de factura
    SET v_numero_factura = CONCAT('FAC-', DATE_FORMAT(NOW(), '%Y%m'), '-', LPAD(p_pago_id, 5, '0'));
    
    -- Insertar factura
    INSERT INTO facturas (
        cliente_id, 
        numero_factura, 
        fecha_emision, 
        fecha_vencimiento, 
        subtotal, 
        iva, 
        total, 
        estado
    ) VALUES (
        v_cliente_id,
        v_numero_factura,
        CURDATE(),
        DATE_ADD(CURDATE(), INTERVAL 30 DAY),
        v_subtotal,
        v_iva,
        v_monto,
        'emitida'
    );
    
    -- Relacionar factura con pago
    INSERT INTO factura_pagos (factura_id, pago_id, monto_aplicado)
    VALUES (LAST_INSERT_ID(), p_pago_id, v_monto);
    
END//

-- Procedimiento: Reporte de ingresos por mes
CREATE PROCEDURE reporte_ingresos_mensual(IN p_year INT, IN p_month INT)
BEGIN
    SELECT 
        DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS dia,
        COUNT(*) AS cantidad_pagos,
        SUM(monto) AS total_dia,
        metodo_pago,
        GROUP_CONCAT(DISTINCT estado_pago) AS estados
    FROM pagos
    WHERE YEAR(fecha_pago) = p_year 
    AND MONTH(fecha_pago) = p_month
    AND estado_pago = 'completado'
    GROUP BY DATE(fecha_pago), metodo_pago
    ORDER BY dia DESC;
END//

-- Procedimiento: Limpiar logs antiguos (más de 1 año)
CREATE PROCEDURE limpiar_logs_antiguos()
BEGIN
    DECLARE v_fecha_limite DATE;
    SET v_fecha_limite = DATE_SUB(CURDATE(), INTERVAL 1 YEAR);
    
    DELETE FROM logs_actividad_clientes WHERE DATE(fecha_hora) < v_fecha_limite;
    DELETE FROM logs_actividad_sistema WHERE DATE(fecha_hora) < v_fecha_limite;
    DELETE FROM logs_pagos WHERE DATE(fecha_cambio) < v_fecha_limite;
    DELETE FROM notificaciones WHERE DATE(fecha_creacion) < v_fecha_limite AND leido = TRUE;
    
    SELECT ROW_COUNT() AS registros_eliminados;
END//

-- Procedimiento: Obtener resumen financiero del cliente
CREATE PROCEDURE resumen_financiero_cliente(IN p_cliente_id INT)
BEGIN
    SELECT 
        'Total gastado' AS concepto,
        COALESCE(SUM(monto), 0) AS monto
    FROM pagos
    WHERE cliente_id = p_cliente_id AND estado_pago = 'completado'
    
    UNION ALL
    
    SELECT 
        'Pagos pendientes' AS concepto,
        COALESCE(SUM(pp.monto), 0) AS monto
    FROM planes_pago pp
    JOIN proyectos p ON pp.proyecto_id = p.id
    WHERE p.cliente_id = p_cliente_id AND pp.estado_cuota = 'pendiente'
    
    UNION ALL
    
    SELECT 
        'Próximas renovaciones' AS concepto,
        COALESCE(SUM(s.precio_unitario), 0) AS monto
    FROM suscripciones_recurrentes s
    WHERE s.cliente_id = p_cliente_id 
    AND s.estado = 'activo'
    AND s.fecha_proxima_facturacion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY);
END//

-- Procedimiento: Dashboard para el administrador
CREATE PROCEDURE dashboard_admin()
BEGIN
    -- Totales generales
    SELECT 
        (SELECT COUNT(*) FROM clientes WHERE estado_cliente = 'activo') AS clientes_activos,
        (SELECT COUNT(*) FROM proyectos WHERE estado_proyecto IN ('en_desarrollo', 'revision', 'aprobado')) AS proyectos_activos,
        (SELECT COUNT(*) FROM pagos WHERE estado_pago = 'pendiente_verificacion') AS pagos_por_verificar,
        (SELECT COUNT(*) FROM tickets_soporte WHERE estado = 'abierto') AS tickets_abiertos;
    
    -- Ingresos del mes actual
    SELECT 
        COALESCE(SUM(monto), 0) AS ingresos_mes,
        COALESCE(SUM(CASE WHEN metodo_pago = 'paypal' THEN monto ELSE 0 END), 0) AS ingresos_paypal,
        COALESCE(SUM(CASE WHEN metodo_pago = 'tarjeta' THEN monto ELSE 0 END), 0) AS ingresos_tarjeta,
        COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN monto ELSE 0 END), 0) AS ingresos_transferencia
    FROM pagos
    WHERE estado_pago = 'completado'
    AND YEAR(fecha_pago) = YEAR(CURDATE())
    AND MONTH(fecha_pago) = MONTH(CURDATE());
    
    -- Próximos vencimientos (30 días)
    SELECT 
        s.nombre_servicio,
        c.nombre_completo,
        c.email,
        s.fecha_proxima_facturacion,
        DATEDIFF(s.fecha_proxima_facturacion, CURDATE()) AS dias_restantes
    FROM suscripciones_recurrentes s
    JOIN clientes c ON s.cliente_id = c.id
    WHERE s.estado = 'activo'
    AND s.fecha_proxima_facturacion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    ORDER BY s.fecha_proxima_facturacion ASC
    LIMIT 10;
END//

DELIMITER ;

-- ==============================================
-- CORRECCIÓN DEL TRIGGER after_insert_suscripcion
-- ==============================================

-- Eliminar el trigger viejo si existe
DROP TRIGGER IF EXISTS after_insert_suscripcion;

DELIMITER //

CREATE TRIGGER after_insert_suscripcion
AFTER INSERT ON suscripciones_recurrentes
FOR EACH ROW
BEGIN
    DECLARE v_dias VARCHAR(10);
    DECLARE v_contador INT DEFAULT 1;
    DECLARE v_preferencias_texto VARCHAR(500);
    DECLARE v_dia_valor INT;
    DECLARE v_pos1 INT;
    DECLARE v_pos2 INT;
    
    -- Obtener preferencias del cliente
    SELECT COALESCE(recordatorio_dias_anticipacion, '[30,15,7,3,1]') INTO v_preferencias_texto
    FROM preferencias_alertas_clientes 
    WHERE cliente_id = NEW.cliente_id;
    
    -- Limpiar corchetes
    SET v_preferencias_texto = REPLACE(REPLACE(v_preferencias_texto, '[', ''), ']', '');
    
    -- Procesar cada día de anticipación
    WHILE v_contador <= 5 DO
        -- Extraer cada valor
        SET v_dias = SUBSTRING_INDEX(SUBSTRING_INDEX(v_preferencias_texto, ',', v_contador), ',', -1);
        SET v_dia_valor = CAST(v_dias AS UNSIGNED);
        
        IF v_dia_valor IS NOT NULL AND v_dia_valor > 0 THEN
            INSERT INTO recordatorios_programados (
                suscripcion_id,
                tipo_recordatorio,
                dias_anticipacion,
                fecha_programada,
                enviado
            ) VALUES (
                NEW.id,
                'vencimiento',
                v_dia_valor,
                DATE_SUB(NEW.fecha_proxima_facturacion, INTERVAL v_dia_valor DAY),
                FALSE
            );
        END IF;
        
        SET v_contador = v_contador + 1;
    END WHILE;
END//

DELIMITER ;

-- ==============================================
-- 13. DATOS DE PRUEBA
-- ==============================================

-- Insertar configuración
INSERT INTO configuracion_empresa (clave, valor, tipo_dato, descripcion) VALUES
('empresa_nombre', 'DigitalWeb Solutions', 'string', 'Nombre de tu empresa'),
('empresa_email', 'info@digitalweb.com', 'string', 'Email para recibir notificaciones de pago'),
('empresa_telefono', '+34 123 456 789', 'string', 'Teléfono de contacto'),
('porcentaje_mora_diario', '0.5', 'decimal', 'Porcentaje de mora por día de atraso'),
('dias_recordatorio_pago', '7,3,1', 'string', 'Días antes para enviar recordatorios'),
('paypal_client_id', 'test_client_id_123', 'string', 'PayPal Client ID'),
('paypal_secret', 'test_secret_456', 'string', 'PayPal Secret'),
('paypal_mode', 'sandbox', 'string', 'sandbox o live'),
('iva_porcentaje', '21', 'decimal', 'IVA estándar'),
('moneda_default', 'EUR', 'string', 'Moneda por defecto');

-- Insertar usuarios del sistema
INSERT INTO usuarios_sistema (nombre_usuario, email, password_hash, rol, permisos) VALUES
('admin', 'admin@digitalweb.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '{"clientes": true, "proyectos": true, "pagos": true, "configuracion": true}'),
('carlos_dev', 'carlos@digitalweb.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'desarrollador', '{"clientes": true, "proyectos": true, "pagos": false}');

-- Insertar clientes de prueba
INSERT INTO clientes (uuid, codigo_cliente, tipo_documento, documento, nombre_completo, email, telefono, direccion, ciudad, empresa, estado_cliente) VALUES
(UUID(), 'CL-2024001', 'DNI', '12345678A', 'Juan Pérez García', 'juan@empresa1.com', '600111222', 'Calle Mayor 1', 'Madrid', 'Empresa Uno SL', 'activo'),
(UUID(), 'CL-2024002', 'NIE', 'Y1234567X', 'María López Ruiz', 'maria@negocio2.com', '600333444', 'Avda. Diagonal 234', 'Barcelona', 'Negocio Dos SA', 'activo'),
(UUID(), 'CL-2024003', 'DNI', '87654321B', 'Carlos Martínez Gil', 'carlos@startup3.com', '600555666', 'Calle Triana 45', 'Sevilla', 'Startup Tres', 'activo');

-- Insertar accesos para clientes (password: cliente123)
INSERT INTO usuario_acceso (cliente_id, email, password_hash) VALUES
(1, 'juan@empresa1.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
(2, 'maria@negocio2.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
(3, 'carlos@startup3.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- Insertar preferencias de alertas
INSERT INTO preferencias_alertas_clientes (cliente_id, recordatorio_dias_anticipacion, notificar_email, notificar_whatsapp) VALUES
(1, '[30, 15, 7, 3, 1]', TRUE, TRUE),
(2, '[15, 7, 3]', TRUE, FALSE),
(3, '[30, 15, 7, 3, 1]', TRUE, TRUE);

-- Insertar catálogo de servicios
INSERT INTO catalogo_servicios (nombre_servicio, tipo_servicio, descripcion, precio_base, unidad_medida) VALUES
('Web Corporativa', 'web', 'Sitio web corporativo hasta 10 páginas', 1200.00, 'unidad'),
('Tienda Online', 'web', 'E-commerce con WooCommerce', 1800.00, 'unidad'),
('App Móvil iOS/Android', 'app_movil', 'App nativa para iOS y Android', 3500.00, 'unidad'),
('API REST', 'api', 'API personalizada', 800.00, 'unidad'),
('Soporte Mensual', 'soporte', 'Mantenimiento y soporte técnico', 150.00, 'mes'),
('Consultoría', 'consultoria', 'Consultoría técnica especializada', 80.00, 'hora'),
('Hosting Básico', 'hosting', 'Hosting compartido 5GB', 120.00, 'año'),
('Dominio .com', 'dominio', 'Registro de dominio .com', 15.00, 'año'),
('SSL Básico', 'ssl', 'Certificado SSL DV', 50.00, 'año');

-- Insertar proyectos
INSERT INTO proyectos (cliente_id, nombre_proyecto, descripcion, tipo_proyecto, estado_proyecto, fecha_inicio, fecha_entrega_pactada, costo_total, incluye_hosting, incluye_dominio, incluye_ssl) VALUES
(1, 'Web Corporativa Empresa Uno', 'Sitio web corporativo con blog', 'web', 'en_desarrollo', '2024-01-10', '2024-02-20', 1200.00, TRUE, TRUE, TRUE),
(2, 'Tienda Online Moda', 'E-commerce para tienda de ropa', 'web', 'revision', '2024-01-15', '2024-02-28', 1800.00, TRUE, TRUE, TRUE),
(3, 'App Delivery', 'App para pedidos a domicilio', 'app_movil', 'aprobado', '2024-02-01', '2024-04-15', 3500.00, FALSE, FALSE, FALSE);

-- Insertar planes de pago (2 y 3 pagos)
INSERT INTO planes_pago (proyecto_id, numero_cuota, nombre_cuota, porcentaje, monto, fecha_limite, estado_cuota, orden_pago) VALUES
-- Proyecto 1 (3 pagos)
(1, 1, 'Pago 1: Dominio + Hosting + SSL', 15, 180.00, '2024-01-10', 'pagado_total', 1),
(1, 2, 'Pago 2: Mitad del proyecto', 50, 600.00, '2024-01-30', 'pagado_total', 2),
(1, 3, 'Pago 3: Saldo final', 35, 420.00, '2024-02-20', 'pendiente', 3),

-- Proyecto 2 (2 pagos)
(2, 1, 'Primer pago: Dominio+Hosting+SSL + Anticipo', 50, 900.00, '2024-01-15', 'pagado_total', 1),
(2, 2, 'Segundo pago: Saldo final contra entrega', 50, 900.00, '2024-02-28', 'pendiente', 2),

-- Proyecto 3 (3 pagos)
(3, 1, 'Primer pago: Inicio del proyecto', 30, 1050.00, '2024-02-01', 'pagado_total', 1),
(3, 2, 'Segundo pago: Demo validada', 40, 1400.00, '2024-03-01', 'pendiente', 2),
(3, 3, 'Tercer pago: Entrega final', 30, 1050.00, '2024-04-15', 'pendiente', 3);

-- Insertar pagos de ejemplo
INSERT INTO pagos (cliente_id, proyecto_id, plan_pago_id, uuid_transaccion, monto, metodo_pago, estado_pago, fecha_pago) VALUES
(1, 1, 1, UUID(), 180.00, 'transferencia', 'completado', '2024-01-10 10:30:00'),
(1, 1, 2, UUID(), 600.00, 'paypal', 'completado', '2024-01-30 15:45:00'),
(2, 2, 4, UUID(), 900.00, 'tarjeta', 'completado', '2024-01-15 12:00:00'),
(3, 3, 7, UUID(), 1050.00, 'transferencia', 'completado', '2024-02-01 09:15:00');

-- Insertar transacciones PayPal de ejemplo
INSERT INTO transacciones_paypal (pago_id, paypal_order_id, paypal_transaction_id, paypal_status, payer_email, payer_name, paypal_fee, net_amount) VALUES
(2, 'ORDER-123456789', 'PAYID-ABCDEF123456', 'COMPLETED', 'juan@empresa1.com', 'Juan Pérez', 18.00, 582.00);

-- Insertar suscripciones recurrentes (hosting, dominio, SSL)
INSERT INTO suscripciones_recurrentes (cliente_id, proyecto_id, tipo_servicio, nombre_servicio, ciclo_facturacion, precio_unitario, fecha_inicio, fecha_proxima_facturacion, fecha_expiracion, estado, renovacion_automatica) VALUES
-- Cliente 1
(1, 1, 'hosting', 'Hosting Básico Anual', 'anual', 120.00, '2024-01-10', '2025-01-10', '2025-01-10', 'activo', TRUE),
(1, 1, 'dominio', 'Dominio empresa1.com', 'anual', 15.00, '2024-01-10', '2025-01-10', '2025-01-10', 'activo', TRUE),
(1, 1, 'ssl', 'SSL Básico', 'anual', 50.00, '2024-01-10', '2025-01-10', '2025-01-10', 'activo', TRUE),

-- Cliente 2
(2, 2, 'hosting', 'Hosting Premium Anual', 'anual', 240.00, '2024-01-15', '2025-01-15', '2025-01-15', 'activo', TRUE),
(2, 2, 'dominio', 'Dominio tiendamoda.com', 'anual', 15.00, '2024-01-15', '2025-01-15', '2025-01-15', 'activo', TRUE),

-- Cliente 3 (próximo a vencer para probar recordatorios)
(3, NULL, 'hosting', 'Hosting Básico', 'anual', 120.00, '2023-12-01', DATE_ADD(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY), 'activo', FALSE),
(3, NULL, 'dominio', 'Dominio appdelivery.com', 'anual', 15.00, '2023-12-01', DATE_ADD(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'activo', FALSE);

-- Insertar categorías de cargos extra
INSERT INTO categorias_cargos_extra (nombre_categoria, descripcion, porcentaje_mora) VALUES
('Atraso en pagos', 'Recargo por pagos fuera de plazo', 5.00),
('Retomar proyecto', 'Costo por reactivar proyecto abandonado', 10.00),
('Cambios extra no pactados', 'Horas adicionales no contempladas', 0),
('Urgencia', 'Procesos express fuera de planificación', 15.00);

-- Insertar cargos extra de ejemplo
INSERT INTO cargos_extra (proyecto_id, categoria_id, motivo, monto_base, iva, monto_total, fecha_cargo, fecha_limite_pago, estado) VALUES
(1, 3, 'Funcionalidad extra: Chat en vivo no contemplado inicialmente', 250.00, 52.50, 302.50, '2024-02-10', '2024-02-25', 'pendiente'),
(2, 1, 'Atraso en segundo pago', 45.00, 9.45, 54.45, '2024-02-28', '2024-03-05', 'pendiente');

-- Insertar tickets de soporte
INSERT INTO tickets_soporte (cliente_id, proyecto_id, asunto, descripcion, prioridad, estado, categoria) VALUES
(1, 1, 'Problema con el formulario de contacto', 'El formulario no envía los correos', 'media', 'en_proceso', 'tecnico'),
(2, 2, 'Duda sobre pasarela de pagos', 'Necesito integrar PayPal además de Stripe', 'alta', 'abierto', 'consulta'),
(3, 3, 'Retraso en la entrega', 'Necesito saber la nueva fecha estimada', 'alta', 'esperando_cliente', 'urgente');

-- Insertar respuestas a tickets
INSERT INTO respuestas_tickets (ticket_id, usuario_sistema_id, mensaje) VALUES
(1, 2, 'Hemos revisado el formulario, parece ser un problema con el SMTP. Lo solucionamos hoy.'),
(1, 1, 'Ya está solucionado el problema del formulario. Por favor, prueba nuevamente.');

-- Insertar notificaciones de ejemplo
INSERT INTO notificaciones (usuario_id, tipo_notificacion, titulo, mensaje, leido) VALUES
(1, 'pago_recibido', '✅ Pago recibido', 'Hemos recibido el pago de la segunda cuota del proyecto', FALSE),
(2, 'recordatorio', '⚠️ Próximo vencimiento', 'Tu hosting vence en 15 días', FALSE);

-- Insertar facturas de ejemplo
INSERT INTO facturas (cliente_id, numero_factura, fecha_emision, fecha_vencimiento, subtotal, iva, total, estado) VALUES
(1, 'FAC-2024-001', '2024-01-10', '2024-01-31', 1200.00, 252.00, 1452.00, 'emitida'),
(2, 'FAC-2024-002', '2024-01-15', '2024-02-05', 1800.00, 378.00, 2178.00, 'emitida');

-- Insertar relación factura-pago
INSERT INTO factura_pagos (factura_id, pago_id, monto_aplicado) VALUES
(1, 1, 180.00),
(1, 2, 600.00),
(2, 3, 900.00);

-- ==============================================
-- 14. CONSULTAS DE VERIFICACIÓN (OPCIONAL)
-- ==============================================

-- Verificar datos insertados
SELECT '=== CLIENTES ===' AS '';
SELECT * FROM clientes;

SELECT '=== PROYECTOS ===' AS '';
SELECT * FROM proyectos;

SELECT '=== PAGOS PENDIENTES ===' AS '';
SELECT * FROM vista_pagos_pendientes;

SELECT '=== PRÓXIMAS RENOVACIONES ===' AS '';
SELECT * FROM vista_proximas_renovaciones;

SELECT '=== CONFIGURACIÓN ===' AS '';
SELECT * FROM configuracion_empresa;

-- Mostrar resumen
SELECT '=== RESUMEN DEL SISTEMA ===' AS '';
SELECT 
    (SELECT COUNT(*) FROM clientes) AS total_clientes,
    (SELECT COUNT(*) FROM proyectos) AS total_proyectos,
    (SELECT COUNT(*) FROM pagos WHERE estado_pago = 'completado') AS pagos_completados,
    (SELECT SUM(monto) FROM pagos WHERE estado_pago = 'completado') AS ingresos_totales,
    (SELECT COUNT(*) FROM suscripciones_recurrentes WHERE estado = 'activo') AS servicios_activos;


ALTER TABLE usuario_acceso 
ADD COLUMN ultimo_acceso TIMESTAMP NULL AFTER password_hash;
-- ==============================================
-- FIN DEL SCRIPT
-- ==============================================