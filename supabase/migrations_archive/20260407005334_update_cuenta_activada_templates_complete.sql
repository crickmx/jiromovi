/*
  # Actualizar Plantillas de Notificación de Cuenta Activada

  ## Cambios
  - Actualizar las plantillas de email, WhatsApp e in-app para cuenta_activada
  - Incluir todos los campos necesarios (password, página web, rol, oficina, puesto)
  - Mejorar el diseño y la información presentada

  ## Campos Disponibles
  - nombre, apellidos, nombre_completo
  - email_laboral, email_personal
  - celular_laboral, celular_personal
  - password
  - rol, oficina, puesto
  - pagina_web
*/

-- Actualizar plantillas del evento cuenta_activada
UPDATE notification_events_catalog
SET 
  template_in_app = jsonb_build_object(
    'titulo', '¡Bienvenido a MOVI Digital!',
    'mensaje', 'Tu cuenta ha sido activada exitosamente. Ya puedes acceder a la plataforma con tu usuario {{email_laboral}}.',
    'variables', ARRAY['nombre', 'apellidos', 'email_laboral']
  ),
  template_email = jsonb_build_object(
    'asunto', 'Tu cuenta ha sido activada - MOVI Digital',
    'html_cuerpo', E'<!DOCTYPE html>
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
        <a href="https://app.movi.digital" class="button">Ingresar a la Plataforma</a>
      </center>
    </div>
  </div>
</body>
</html>',
    'variables', ARRAY['nombre', 'apellidos', 'email_laboral', 'password', 'rol', 'oficina', 'puesto', 'pagina_web']
  ),
  template_whatsapp = jsonb_build_object(
    'mensaje', E'¡Bienvenido {{nombre}} a MOVI Digital! 🎉\n\nTu cuenta ha sido activada.\n\n📧 Usuario: {{email_laboral}}\n🔑 Contraseña: {{password}}\n👤 Rol: {{rol}}\n🏢 Oficina: {{oficina}}\n🌐 Tu página: {{pagina_web}}\n\n⚠️ Cambia tu contraseña después del primer inicio de sesión.\n\nIngresa ahora: https://app.movi.digital',
    'variables', ARRAY['nombre', 'email_laboral', 'password', 'rol', 'oficina', 'pagina_web']
  ),
  updated_at = now()
WHERE event_code = 'cuenta_activada';

COMMENT ON TABLE notification_events_catalog IS 
  'Catálogo central de eventos de notificación. Evento cuenta_activada actualizado con plantillas completas para email, WhatsApp e in-app.';
