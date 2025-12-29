/*
  # Sistema Completo de Plantillas de Notificaciones

  ## Cambios
  1. Agregar tipos de notificación faltantes
  2. Crear plantillas para todos los procesos automatizados
  3. Actualizar plantillas existentes para incluir canales
  4. Documentar campos disponibles para cada tipo
  5. Limpiar tipos de notificación sin uso

  ## Tipos de Notificación
  - cuenta_activada: Usuario activado (cuenta nueva o reactivación)
  - cumpleanos_contacto: Recordatorio de cumpleaños de contacto CRM
  - reserva_espacio: Confirmación de reserva en Espacio Jiro
  - usuario_nuevo_pendiente: Notificar a administradores sobre usuario pendiente
  - nuevo_comunicado: Nuevo comunicado publicado
  - nuevo_evento: Nuevo evento en Seguros Education
  - cancelacion_evento: Evento cancelado
  - recordatorio_evento: Recordatorio de evento próximo
  - notificacion_individual: Notificación personalizada del sistema
  - password_reset: Recuperación de contraseña

  ## Campos Disponibles por Tipo

  ### cuenta_activada
  - nombre, apellidos, email_laboral, password, rol, oficina, pagina_web, puesto

  ### cumpleanos_contacto  
  - nombre_contacto, edad, contacto_url

  ### reserva_espacio
  - nombre_usuario, espacio_nombre, fecha, hora_inicio, hora_fin

  ### usuario_nuevo_pendiente
  - nombre_usuario, email, rol, oficina, url_aprobacion

  ### nuevo_comunicado
  - titulo, categoria, url, autor

  ### nuevo_evento / recordatorio_evento / cancelacion_evento
  - titulo_evento, fecha_evento, hora_evento, descripcion, url

  ### notificacion_individual
  - titulo, mensaje, url

  ### password_reset
  - nombre, reset_link, nombre_plataforma
*/

-- 1. Agregar tipos de notificación faltantes
INSERT INTO correo_tipos_notificacion (codigo, nombre, activo, enviar_correo, enviar_whatsapp, enviar_notificacion)
VALUES
  ('cumpleanos_contacto', 'Cumpleaños de Contacto CRM', true, false, true, true),
  ('reserva_espacio', 'Confirmación de Reserva Espacio Jiro', true, true, false, true),
  ('usuario_nuevo_pendiente', 'Nuevo Usuario Pendiente de Aprobación', true, true, false, true)
ON CONFLICT (codigo) DO UPDATE SET
  activo = EXCLUDED.activo,
  enviar_correo = EXCLUDED.enviar_correo,
  enviar_whatsapp = EXCLUDED.enviar_whatsapp,
  enviar_notificacion = EXCLUDED.enviar_notificacion;

-- 2. Activar tipo "cuenta_activada" y configurar canales
UPDATE correo_tipos_notificacion
SET 
  activo = true,
  enviar_correo = true,
  enviar_whatsapp = true,
  enviar_notificacion = true
WHERE codigo = 'cuenta_activada';

-- 3. Desactivar tipo "bienvenida" (obsoleto, ahora se usa cuenta_activada)
UPDATE correo_tipos_notificacion
SET activo = false
WHERE codigo = 'bienvenida';

-- 4. Desactivar tipo "commission_batch_closed" (usa transactional_notification_templates)
UPDATE correo_tipos_notificacion
SET activo = false
WHERE codigo = 'commission_batch_closed';

-- 5. Actualizar plantilla de cuenta_activada para incluir todos los canales
UPDATE correo_plantillas p
SET 
  enviar_correo = true,
  enviar_whatsapp = true,
  enviar_notificacion = true,
  variables_disponibles = ARRAY['nombre', 'apellidos', 'email_laboral', 'password', 'rol', 'oficina', 'pagina_web', 'puesto'],
  whatsapp_variables_disponibles = ARRAY['nombre', 'apellidos', 'email_laboral', 'password', 'rol', 'oficina', 'pagina_web'],
  notificacion_variables_disponibles = ARRAY['nombre'],
  html_cuerpo = E'<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
    .info-item { margin: 10px 0; }
    .label { font-weight: bold; color: #667eea; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; border-left: 4px solid #ffc107; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Bienvenido a MOVI Digital!</h1>
      <p>Tu cuenta ha sido activada exitosamente</p>
    </div>
    <div class="content">
      <p>Hola {{nombre}} {{apellidos}},</p>
      <p>¡Nos alegra darte la bienvenida a <strong>MOVI Digital</strong>! Tu cuenta ha sido activada y ya puedes comenzar a usar todas las funcionalidades de la plataforma.</p>
      
      <div class="info-box">
        <div class="info-item">
          <span class="label">📧 Usuario:</span> {{email_laboral}}
        </div>
        <div class="info-item">
          <span class="label">🔑 Contraseña:</span> {{password}}
        </div>
        <div class="info-item">
          <span class="label">👤 Rol:</span> {{rol}}
        </div>
        <div class="info-item">
          <span class="label">🏢 Oficina:</span> {{oficina}}
        </div>
        <div class="info-item">
          <span class="label">💼 Puesto:</span> {{puesto}}
        </div>
        <div class="info-item">
          <span class="label">🌐 Tu Página Web:</span> {{pagina_web}}
        </div>
      </div>
      
      <div class="warning">
        <strong>⚠️ Importante:</strong> Por tu seguridad, te recomendamos cambiar tu contraseña después del primer inicio de sesión.
      </div>
      
      <center>
        <a href="https://app.grupojiro.com" class="button">Ingresar a la Plataforma</a>
      </center>
    </div>
  </div>
</body>
</html>',
  whatsapp_plantilla = E'¡Bienvenido {{nombre}} {{apellidos}} a MOVI Digital! 🎉

Tu cuenta ha sido activada exitosamente.

📧 Usuario: {{email_laboral}}
🔑 Contraseña: {{password}}
👤 Rol: {{rol}}
🏢 Oficina: {{oficina}}
🌐 Tu página web: {{pagina_web}}

⚠️ Por seguridad, cambia tu contraseña después del primer inicio de sesión.

Ingresa a la plataforma para comenzar.',
  notificacion_titulo = '¡Bienvenido a MOVI Digital!',
  notificacion_cuerpo = 'Hola {{nombre}}, tu cuenta ha sido activada exitosamente. Explora todas las funcionalidades de la plataforma.'
WHERE tipo_notificacion_id = (SELECT id FROM correo_tipos_notificacion WHERE codigo = 'cuenta_activada');

-- 6. Crear plantilla para cumpleaños de contacto
INSERT INTO correo_plantillas (
  tipo_notificacion_id, 
  asunto, 
  html_cuerpo,
  whatsapp_plantilla, 
  notificacion_titulo,
  notificacion_cuerpo,
  variables_disponibles,
  whatsapp_variables_disponibles,
  notificacion_variables_disponibles,
  enviar_correo, 
  enviar_whatsapp, 
  enviar_notificacion
)
SELECT 
  id,
  '🎂 ¡Hoy es el cumpleaños de {{nombre_contacto}}!',
  '',
  E'🎂 ¡Cumpleaños hoy!

Hoy es el cumpleaños de {{nombre_contacto}}.

¡No olvides felicitarlo! 🎉',
  '🎂 Cumpleaños hoy',
  'Hoy es el cumpleaños de {{nombre_contacto}}. ¡Escríbele o llámale!',
  ARRAY['nombre_contacto', 'edad', 'contacto_url'],
  ARRAY['nombre_contacto'],
  ARRAY['nombre_contacto'],
  false,
  true,
  true
FROM correo_tipos_notificacion
WHERE codigo = 'cumpleanos_contacto'
ON CONFLICT DO NOTHING;

-- 7. Crear plantilla para reserva de espacio
INSERT INTO correo_plantillas (
  tipo_notificacion_id, 
  asunto, 
  html_cuerpo,
  whatsapp_plantilla,
  notificacion_titulo,
  notificacion_cuerpo,
  variables_disponibles,
  whatsapp_variables_disponibles,
  notificacion_variables_disponibles,
  enviar_correo, 
  enviar_whatsapp, 
  enviar_notificacion
)
SELECT 
  id,
  'Reserva confirmada: {{espacio_nombre}}',
  E'<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; }
    .reservation-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Reserva Confirmada</h1>
    </div>
    <div class="content">
      <p>Hola {{nombre_usuario}},</p>
      <p>Tu reserva ha sido confirmada exitosamente:</p>
      <div class="reservation-box">
        <p><strong>📍 Espacio:</strong> {{espacio_nombre}}</p>
        <p><strong>📅 Fecha:</strong> {{fecha}}</p>
        <p><strong>🕐 Hora:</strong> {{hora_inicio}} - {{hora_fin}}</p>
      </div>
    </div>
  </div>
</body>
</html>',
  E'✅ Reserva confirmada

Hola {{nombre_usuario}},

Tu reserva en {{espacio_nombre}} ha sido confirmada:

📅 Fecha: {{fecha}}
🕐 Hora: {{hora_inicio}} - {{hora_fin}}',
  '✅ Reserva confirmada',
  'Tu reserva en {{espacio_nombre}} ha sido confirmada para el {{fecha}}',
  ARRAY['nombre_usuario', 'espacio_nombre', 'fecha', 'hora_inicio', 'hora_fin'],
  ARRAY['nombre_usuario', 'espacio_nombre', 'fecha', 'hora_inicio', 'hora_fin'],
  ARRAY['espacio_nombre', 'fecha'],
  true,
  false,
  true
FROM correo_tipos_notificacion
WHERE codigo = 'reserva_espacio'
ON CONFLICT DO NOTHING;

-- 8. Crear plantilla para usuario nuevo pendiente
INSERT INTO correo_plantillas (
  tipo_notificacion_id, 
  asunto, 
  html_cuerpo,
  notificacion_titulo,
  notificacion_cuerpo,
  variables_disponibles,
  notificacion_variables_disponibles,
  enviar_correo, 
  enviar_whatsapp, 
  enviar_notificacion
)
SELECT 
  id,
  '👤 Nuevo usuario pendiente de aprobación',
  E'<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #fbbf24; color: #1f2937; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; }
    .user-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👤 Nuevo Usuario Pendiente</h1>
    </div>
    <div class="content">
      <p>Se ha registrado un nuevo usuario que requiere aprobación:</p>
      <div class="user-box">
        <p><strong>Nombre:</strong> {{nombre_usuario}}</p>
        <p><strong>Email:</strong> {{email}}</p>
        <p><strong>Rol solicitado:</strong> {{rol}}</p>
        <p><strong>Oficina:</strong> {{oficina}}</p>
      </div>
      <center>
        <a href="{{url_aprobacion}}" class="button">Revisar y Aprobar</a>
      </center>
    </div>
  </div>
</body>
</html>',
  '👤 Nuevo usuario pendiente',
  '{{nombre_usuario}} requiere aprobación. Rol: {{rol}}, Oficina: {{oficina}}',
  ARRAY['nombre_usuario', 'email', 'rol', 'oficina', 'url_aprobacion'],
  ARRAY['nombre_usuario', 'rol', 'oficina'],
  true,
  false,
  true
FROM correo_tipos_notificacion
WHERE codigo = 'usuario_nuevo_pendiente'
ON CONFLICT DO NOTHING;

-- 9. Actualizar variables disponibles para plantillas existentes
UPDATE correo_plantillas p
SET 
  variables_disponibles = CASE 
    WHEN tn.codigo = 'nuevo_comunicado' THEN ARRAY['titulo', 'categoria', 'url', 'autor']
    WHEN tn.codigo = 'nuevo_evento' THEN ARRAY['titulo_evento', 'fecha_evento', 'hora_evento', 'descripcion', 'url']
    WHEN tn.codigo = 'cancelacion_evento' THEN ARRAY['titulo_evento', 'fecha_evento', 'hora_evento', 'descripcion', 'url']
    WHEN tn.codigo = 'recordatorio_evento' THEN ARRAY['titulo_evento', 'fecha_evento', 'hora_evento', 'descripcion', 'url']
    WHEN tn.codigo = 'notificacion_individual' THEN ARRAY['titulo', 'mensaje', 'url']
    WHEN tn.codigo = 'password_reset' THEN ARRAY['nombre', 'reset_link', 'nombre_plataforma']
    WHEN tn.codigo = 'notificacion_personalizada' THEN ARRAY['titulo', 'mensaje', 'url']
    ELSE p.variables_disponibles
  END,
  whatsapp_variables_disponibles = CASE 
    WHEN tn.codigo IN ('nuevo_comunicado', 'nuevo_evento', 'cancelacion_evento', 'recordatorio_evento') 
      THEN ARRAY['titulo', 'fecha', 'url']
    WHEN tn.codigo = 'notificacion_individual' THEN ARRAY['titulo', 'mensaje']
    WHEN tn.codigo = 'notificacion_personalizada' THEN ARRAY['titulo', 'mensaje']
    ELSE p.whatsapp_variables_disponibles
  END,
  notificacion_variables_disponibles = CASE
    WHEN tn.codigo IN ('nuevo_comunicado', 'nuevo_evento', 'cancelacion_evento', 'recordatorio_evento')
      THEN ARRAY['titulo']
    WHEN tn.codigo IN ('notificacion_individual', 'notificacion_personalizada') THEN ARRAY['titulo', 'mensaje']
    ELSE p.notificacion_variables_disponibles
  END
FROM correo_tipos_notificacion tn
WHERE p.tipo_notificacion_id = tn.id;

-- 10. Agregar comentarios para documentación
COMMENT ON TABLE correo_tipos_notificacion IS 
  'Tipos de notificaciones del sistema. Cada tipo define qué canales están disponibles por defecto.';

COMMENT ON TABLE correo_plantillas IS 
  'Plantillas de notificaciones transaccionales. Cada plantilla puede activar/desactivar canales independientemente.';

COMMENT ON COLUMN correo_plantillas.html_cuerpo IS 
  'Contenido HTML del correo. Soporta variables {{nombre_variable}}.';

COMMENT ON COLUMN correo_plantillas.whatsapp_plantilla IS 
  'Contenido de WhatsApp en texto plano. Soporta variables {{nombre_variable}}.';

COMMENT ON COLUMN correo_plantillas.notificacion_titulo IS
  'Título para la notificación interna (campanita).';

COMMENT ON COLUMN correo_plantillas.notificacion_cuerpo IS
  'Cuerpo del mensaje para la notificación interna.';

COMMENT ON COLUMN correo_plantillas.enviar_correo IS 
  'Si esta plantilla enviará notificaciones por correo';

COMMENT ON COLUMN correo_plantillas.enviar_whatsapp IS 
  'Si esta plantilla enviará notificaciones por WhatsApp';

COMMENT ON COLUMN correo_plantillas.enviar_notificacion IS 
  'Si esta plantilla creará notificaciones internas (campanita)';

COMMENT ON COLUMN correo_plantillas.variables_disponibles IS
  'Lista de variables que pueden usarse en el HTML del correo';

COMMENT ON COLUMN correo_plantillas.whatsapp_variables_disponibles IS
  'Lista de variables que pueden usarse en WhatsApp';

COMMENT ON COLUMN correo_plantillas.notificacion_variables_disponibles IS
  'Lista de variables que pueden usarse en notificaciones internas';
