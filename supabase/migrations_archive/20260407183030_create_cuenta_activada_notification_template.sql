/*
  # Create cuenta_activada notification template
  
  1. Changes
    - Add template for cuenta_activada event in transactional_notification_templates
    - Enable email, WhatsApp and in-app notifications
    - Include all necessary variables for welcome message
  
  2. Security
    - No RLS changes needed
*/

-- Insert cuenta_activada template
INSERT INTO transactional_notification_templates (
  event_key,
  name,
  email_subject_template,
  email_body_template,
  whatsapp_body_template,
  inapp_title_template,
  inapp_body_template,
  is_active
) VALUES (
  'cuenta_activada',
  'Cuenta Activada - Bienvenida',
  '¡Bienvenido a Movi Digital, {{nombre_completo}}!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Bienvenido a Movi Digital!</h1>
      <p>Tu cuenta ha sido activada exitosamente</p>
    </div>
    <div class="content">
      <p>Hola <strong>{{nombre_completo}}</strong>,</p>
      
      <p>¡Nos da mucho gusto darte la bienvenida a <strong>Movi Digital</strong>! Tu cuenta ha sido activada y ya puedes acceder a todas las herramientas de la plataforma.</p>
      
      <div class="info-box">
        <h3>📋 Información de tu cuenta:</h3>
        <ul>
          <li><strong>Correo:</strong> {{email_laboral}}</li>
          <li><strong>Rol:</strong> {{rol}}</li>
          <li><strong>Oficina:</strong> {{oficina}}</li>
          <li><strong>Puesto:</strong> {{puesto}}</li>
        </ul>
      </div>
      
      <div class="info-box">
        <h3>🌐 Tu página web personal:</h3>
        <p>{{pagina_web}}</p>
      </div>
      
      <p><strong>Para acceder a la plataforma:</strong></p>
      <ol>
        <li>Ve a <a href="https://app.movi.digital">app.movi.digital</a></li>
        <li>Ingresa con tu correo: <strong>{{email_laboral}}</strong></li>
        <li>Usa la contraseña que configuraste</li>
      </ol>
      
      <center>
        <a href="https://app.movi.digital" class="button">Acceder a Movi Digital</a>
      </center>
      
      <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactar a tu gerente o al equipo de soporte.</p>
      
      <p>¡Éxito en tu gestión!</p>
      
      <p><strong>Equipo Movi Digital</strong></p>
    </div>
    <div class="footer">
      <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>',
  '🎉 ¡Bienvenido {{nombre_completo}}!

Tu cuenta en Movi Digital ha sido activada exitosamente.

📧 Usuario: {{email_laboral}}
👤 Rol: {{rol}}
🏢 Oficina: {{oficina}}

🌐 Tu página web: {{pagina_web}}

Accede ahora en: https://app.movi.digital

¡Éxito en tu gestión! 🚀',
  '🎉 ¡Cuenta Activada!',
  'Tu cuenta en Movi Digital ha sido activada. Ya puedes acceder a la plataforma con tu correo {{email_laboral}}.',
  true
) ON CONFLICT (event_key) DO UPDATE SET
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  inapp_title_template = EXCLUDED.inapp_title_template,
  inapp_body_template = EXCLUDED.inapp_body_template,
  is_active = EXCLUDED.is_active,
  updated_at = now();

COMMENT ON TABLE transactional_notification_templates IS 
  'Templates for transactional notifications sent via notify() function';
