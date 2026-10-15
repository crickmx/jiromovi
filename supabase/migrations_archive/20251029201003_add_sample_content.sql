/*
  # Contenido Inicial - MOVI Digital
  Inserta datos de ejemplo en las tablas principales
*/

-- OFICINAS
UPDATE oficinas SET nombre = 'CDMX Centro', director = 'Christofer Cruz-Chousal', gerente = 'María González', domicilio = 'Av. Reforma 123, CDMX', telefono = '55-1234-5678', email = 'cdmx@jiro.com.mx' WHERE id = '28ebde01-46a1-4e41-af76-fe753f3f0ab2';
UPDATE oficinas SET nombre = 'Guadalajara', director = 'Roberto Sánchez', gerente = 'Laura Martínez', domicilio = 'Av. Chapultepec 456, GDL', telefono = '33-2345-6789', email = 'gdl@jiro.com.mx' WHERE id = 'c661051d-6333-4a1d-aec3-184137ebf436';

INSERT INTO oficinas (nombre, director, gerente, domicilio, telefono, email, activa)
SELECT 'Monterrey', 'Carlos Hernández', 'Ana López', 'Av. Constitución 789', '81-3456-7890', 'mty@jiro.com.mx', true
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'Monterrey');

INSERT INTO oficinas (nombre, director, gerente, domicilio, telefono, email, activa)
SELECT 'Puebla', 'José Ramírez', 'Patricia Torres', 'Blvd. 5 de Mayo 321', '22-4567-8901', 'puebla@jiro.com.mx', true
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'Puebla');

INSERT INTO oficinas (nombre, director, gerente, domicilio, telefono, email, activa)
SELECT 'Querétaro', 'Miguel Flores', 'Gabriela Ruiz', 'Av. Constituyentes 654', '44-5678-9012', 'qro@jiro.com.mx', true
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'Querétaro');

-- ÁREAS
INSERT INTO areas (nombre, descripcion, capacidad, activo) SELECT 'Sala Principal', 'Sala grande con proyector', 20, true WHERE NOT EXISTS (SELECT 1 FROM areas WHERE nombre = 'Sala Principal');
INSERT INTO areas (nombre, descripcion, capacidad, activo) SELECT 'Sala Pequeña', 'Reuniones de hasta 8 personas', 8, true WHERE NOT EXISTS (SELECT 1 FROM areas WHERE nombre = 'Sala Pequeña');
INSERT INTO areas (nombre, descripcion, capacidad, activo) SELECT 'Auditorio', 'Eventos y capacitaciones masivas', 100, true WHERE NOT EXISTS (SELECT 1 FROM areas WHERE nombre = 'Auditorio');
INSERT INTO areas (nombre, descripcion, capacidad, activo) SELECT 'Sala Capacitación', 'Equipada con computadoras', 30, true WHERE NOT EXISTS (SELECT 1 FROM areas WHERE nombre = 'Sala Capacitación');
INSERT INTO areas (nombre, descripcion, capacidad, activo) SELECT 'Sala Ejecutiva', 'Reuniones privadas', 6, true WHERE NOT EXISTS (SELECT 1 FROM areas WHERE nombre = 'Sala Ejecutiva');
INSERT INTO areas (nombre, descripcion, capacidad, activo) SELECT 'Cubículo', 'Trabajo individual concentrado', 1, true WHERE NOT EXISTS (SELECT 1 FROM areas WHERE nombre = 'Cubículo');

-- ESQUEMAS PAGO
INSERT INTO esquemas_pago (nombre, descripcion, activo) SELECT 'Quincenal', 'Pago cada 15 días por depósito', true WHERE NOT EXISTS (SELECT 1 FROM esquemas_pago WHERE nombre = 'Quincenal');
INSERT INTO esquemas_pago (nombre, descripcion, activo) SELECT 'Semanal', 'Pago semanal por depósito', true WHERE NOT EXISTS (SELECT 1 FROM esquemas_pago WHERE nombre = 'Semanal');
INSERT INTO esquemas_pago (nombre, descripcion, activo) SELECT 'Mensual', 'Pago mensual por depósito', true WHERE NOT EXISTS (SELECT 1 FROM esquemas_pago WHERE nombre = 'Mensual');
INSERT INTO esquemas_pago (nombre, descripcion, activo) SELECT 'Comisiones', 'Pago basado en comisiones por ventas', true WHERE NOT EXISTS (SELECT 1 FROM esquemas_pago WHERE nombre = 'Comisiones');
INSERT INTO esquemas_pago (nombre, descripcion, activo) SELECT 'Mixto', 'Salario base más comisiones variables', true WHERE NOT EXISTS (SELECT 1 FROM esquemas_pago WHERE nombre = 'Mixto');
INSERT INTO esquemas_pago (nombre, descripcion, activo) SELECT 'Honorarios', 'Pago por servicios profesionales', true WHERE NOT EXISTS (SELECT 1 FROM esquemas_pago WHERE nombre = 'Honorarios');

-- CATEGORÍAS EDUCACIÓN
INSERT INTO seguros_categories (nombre, descripcion, icono, orden, activa) SELECT 'Fundamentos de Seguros', 'Conceptos básicos del mundo asegurador', '📚', 1, true WHERE NOT EXISTS (SELECT 1 FROM seguros_categories WHERE nombre = 'Fundamentos de Seguros');
INSERT INTO seguros_categories (nombre, descripcion, icono, orden, activa) SELECT 'Seguros de Vida', 'Todo sobre seguros de vida y beneficiarios', '❤️', 2, true WHERE NOT EXISTS (SELECT 1 FROM seguros_categories WHERE nombre = 'Seguros de Vida');
INSERT INTO seguros_categories (nombre, descripcion, icono, orden, activa) SELECT 'Seguros de Autos', 'Coberturas vehiculares y RC', '🚗', 3, true WHERE NOT EXISTS (SELECT 1 FROM seguros_categories WHERE nombre = 'Seguros de Autos');
INSERT INTO seguros_categories (nombre, descripcion, icono, orden, activa) SELECT 'Seguros de Salud', 'Gastos médicos mayores y menores', '🏥', 4, true WHERE NOT EXISTS (SELECT 1 FROM seguros_categories WHERE nombre = 'Seguros de Salud');
INSERT INTO seguros_categories (nombre, descripcion, icono, orden, activa) SELECT 'Seguros Empresariales', 'Protección para negocios y empresas', '🏢', 5, true WHERE NOT EXISTS (SELECT 1 FROM seguros_categories WHERE nombre = 'Seguros Empresariales');
INSERT INTO seguros_categories (nombre, descripcion, icono, orden, activa) SELECT 'Técnicas de Venta', 'Habilidades para vender seguros', '💼', 6, true WHERE NOT EXISTS (SELECT 1 FROM seguros_categories WHERE nombre = 'Técnicas de Venta');
INSERT INTO seguros_categories (nombre, descripcion, icono, orden, activa) SELECT 'Atención al Cliente', 'Excelencia en servicio y retención', '😊', 7, true WHERE NOT EXISTS (SELECT 1 FROM seguros_categories WHERE nombre = 'Atención al Cliente');
INSERT INTO seguros_categories (nombre, descripcion, icono, orden, activa) SELECT 'Marco Legal', 'Normatividad y regulación mexicana', '⚖️', 8, true WHERE NOT EXISTS (SELECT 1 FROM seguros_categories WHERE nombre = 'Marco Legal');

-- PLANTILLAS EMAIL
INSERT INTO email_templates (nombre, asunto, cuerpo, tipo, activo) SELECT 'Bienvenida Empleado', 'Bienvenido a MOVI Digital', '<h2>¡Bienvenido!</h2><p>Hola {{nombre}},</p><p>Es un placer tenerte en el equipo.</p>', 'bienvenida', true WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE nombre = 'Bienvenida Empleado');
INSERT INTO email_templates (nombre, asunto, cuerpo, tipo, activo) SELECT 'Solicitud Vacaciones', 'Solicitud de Vacaciones', '<h2>Solicitud</h2><p>{{nombre}} solicita vacaciones del {{inicio}} al {{fin}}</p>', 'vacaciones', true WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE nombre = 'Solicitud Vacaciones');
INSERT INTO email_templates (nombre, asunto, cuerpo, tipo, activo) SELECT 'Aprobación Vacaciones', 'Vacaciones Aprobadas', '<h2>¡Aprobado!</h2><p>Tus vacaciones fueron aprobadas. Disfruta del {{inicio}} al {{fin}}</p>', 'vacaciones', true WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE nombre = 'Aprobación Vacaciones');
INSERT INTO email_templates (nombre, asunto, cuerpo, tipo, activo) SELECT 'Recordatorio Reunión', 'Reunión en {{minutos}} minutos', '<h2>Recordatorio</h2><p>Reunión: {{titulo}}</p><p>Hora: {{hora}}</p><p>Link: {{link}}</p>', 'reunion', true WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE nombre = 'Recordatorio Reunión');
INSERT INTO email_templates (nombre, asunto, cuerpo, tipo, activo) SELECT 'Cumpleaños', '¡Feliz Cumpleaños!', '<h2>🎉 Feliz Cumpleaños {{nombre}}!</h2><p>Todo el equipo te desea un feliz día.</p>', 'celebracion', true WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE nombre = 'Cumpleaños');
