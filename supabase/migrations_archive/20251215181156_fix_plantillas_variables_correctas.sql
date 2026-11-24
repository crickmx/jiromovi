/*
  # Corrección de Variables en Plantillas de Notificaciones Transaccionales

  1. Propósito
    - Actualizar las variables disponibles en todas las plantillas
    - Incluir campos importantes como email_laboral, celular_laboral, etc.
    - Corregir plantillas existentes para usar las variables correctas

  2. Variables Actualizadas
    - Usuario: nombre, apellidos, email_personal, email_laboral, celular_personal, celular_laboral, puesto, rol, oficina
    - Evento: titulo_evento, fecha_evento, hora_evento, link_evento, ponente
    - Sistema: nombre_plataforma, fecha
    - Especiales: reset_link (recuperación), link_recuperacion

  3. Cambios
    - Actualizar arrays de variables_disponibles
    - Actualizar plantillas HTML para usar email_laboral donde corresponda
*/

-- Actualizar plantilla de Bienvenida
UPDATE correo_plantillas
SET 
  html_cuerpo = '<h2>¡Bienvenido {{nombre}} {{apellidos}}!</h2><p>Tu cuenta ha sido creada exitosamente.</p><p><strong>Email Laboral:</strong> {{email_laboral}}</p><p><strong>Email Personal:</strong> {{email_personal}}</p><p><strong>Rol:</strong> {{rol}}</p><p><strong>Oficina:</strong> {{oficina}}</p><p>Ingresa a la plataforma para comenzar.</p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_personal}}', '{{email_laboral}}', '{{celular_personal}}', '{{celular_laboral}}', '{{rol}}', '{{puesto}}', '{{oficina}}', '{{nombre_plataforma}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'bienvenida'
);

-- Actualizar plantilla de Recuperación de Password
UPDATE correo_plantillas
SET 
  html_cuerpo = '<h2>Recuperación de contraseña</h2><p>Hola {{nombre}},</p><p>Has solicitado restablecer tu contraseña.</p><p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p><p><a href="{{link_recuperacion}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Restablecer Contraseña</a></p><p>Si no solicitaste este cambio, ignora este correo.</p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{link_recuperacion}}', '{{nombre_plataforma}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'recuperacion_password'
);

-- Actualizar plantilla de Nuevo Evento
UPDATE correo_plantillas
SET 
  html_cuerpo = '<h2>Nuevo evento disponible</h2><p>Hola {{nombre}},</p><p>Se ha programado un nuevo evento:</p><p><strong>{{titulo_evento}}</strong></p><p><strong>Ponente:</strong> {{ponente}}</p><p><strong>Fecha:</strong> {{fecha_evento}}</p><p><strong>Hora:</strong> {{hora_evento}}</p><p><a href="{{link_evento}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Ver detalles</a></p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{titulo_evento}}', '{{fecha_evento}}', '{{hora_evento}}', '{{link_evento}}', '{{ponente}}', '{{descripcion_evento}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'nuevo_evento'
);

-- Actualizar plantilla de Cuenta Activada
UPDATE correo_plantillas
SET 
  html_cuerpo = '<h2>¡Tu cuenta ha sido activada!</h2><p>Hola {{nombre}},</p><p>Tu cuenta en {{nombre_plataforma}} ha sido activada por el administrador.</p><p>Ya puedes acceder con tu email laboral: <strong>{{email_laboral}}</strong></p><p>Tu rol asignado es: <strong>{{rol}}</strong></p><p>Oficina: <strong>{{oficina}}</strong></p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{rol}}', '{{oficina}}', '{{nombre_plataforma}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'cuenta_activada'
);

-- Actualizar plantilla de Capacitación Obligatoria
UPDATE correo_plantillas
SET 
  html_cuerpo = '<h2>Capacitación obligatoria</h2><p>Hola {{nombre}},</p><p>Se ha programado una capacitación <strong>obligatoria</strong>:</p><p><strong>{{titulo_evento}}</strong></p><p><strong>Ponente:</strong> {{ponente}}</p><p><strong>Fecha:</strong> {{fecha_evento}}</p><p><strong>Hora:</strong> {{hora_evento}}</p><p>Tu asistencia es <strong>requerida</strong>.</p><p><a href="{{link_evento}}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirmar Asistencia</a></p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{titulo_evento}}', '{{fecha_evento}}', '{{hora_evento}}', '{{link_evento}}', '{{ponente}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'capacitacion_obligatoria'
);

-- Actualizar plantilla de Cancelación de Evento
UPDATE correo_plantillas
SET 
  html_cuerpo = '<h2>Evento cancelado</h2><p>Hola {{nombre}},</p><p>El siguiente evento ha sido cancelado:</p><p><strong>{{titulo_evento}}</strong></p><p><strong>Fecha original:</strong> {{fecha_evento}}</p><p>Disculpa las molestias.</p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{titulo_evento}}', '{{fecha_evento}}', '{{motivo_cancelacion}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'cancelacion_evento'
);

-- Actualizar plantilla de Recordatorio de Evento
UPDATE correo_plantillas
SET 
  html_cuerpo = '<h2>Recordatorio de evento</h2><p>Hola {{nombre}},</p><p>Te recordamos que tienes un evento próximo:</p><p><strong>{{titulo_evento}}</strong></p><p><strong>Ponente:</strong> {{ponente}}</p><p><strong>Fecha:</strong> {{fecha_evento}}</p><p><strong>Hora:</strong> {{hora_evento}}</p><p><a href="{{link_evento}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Unirse ahora</a></p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{titulo_evento}}', '{{fecha_evento}}', '{{hora_evento}}', '{{link_evento}}', '{{ponente}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'recordatorio_evento'
);

-- Actualizar plantilla de Notificación Personalizada
UPDATE correo_plantillas
SET 
  html_cuerpo = '<h2>Notificación</h2><p>Hola {{nombre}} {{apellidos}},</p><p>Este es un mensaje personalizado del administrador.</p><p><strong>Oficina:</strong> {{oficina}}</p><p><strong>Puesto:</strong> {{puesto}}</p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_personal}}', '{{email_laboral}}', '{{celular_personal}}', '{{celular_laboral}}', '{{rol}}', '{{puesto}}', '{{oficina}}', '{{nombre_plataforma}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'notificacion_personalizada'
);

-- Actualizar plantilla de Password Reset (si existe)
UPDATE correo_plantillas
SET 
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{reset_link}}', '{{nombre_plataforma}}', '{{fecha}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'password_reset'
);