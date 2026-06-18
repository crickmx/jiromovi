/*
  # Add acceso_passwordless notification type and template

  1. New Notification Type
    - `acceso_passwordless` in module AUTH
    - Allows admin to edit login code email/WhatsApp templates

  2. New Template
    - Email: branded HTML with code display box and magic link button
    - WhatsApp: concise message with code and magic link
    - Variables: {{nombre}}, {{codigo}}, {{magic_link}}, {{plataforma}}, {{minutos_validez}}

  3. Notes
    - Template can be edited via Notificaciones > AUTH section in admin UI
    - Used by send-login-code edge function
*/

-- Insert notification type
INSERT INTO correo_tipos_notificacion (nombre, codigo, modulo, descripcion)
VALUES (
  'Código de Acceso (Passwordless)',
  'acceso_passwordless',
  'AUTH',
  'Enviado cuando un usuario solicita acceso mediante código de verificación o magic link'
)
ON CONFLICT (codigo) DO NOTHING;

-- Insert default template linked to the new type
INSERT INTO correo_plantillas (
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  variables_disponibles,
  whatsapp_plantilla,
  whatsapp_variables_disponibles,
  notificacion_titulo,
  notificacion_cuerpo,
  notificacion_variables_disponibles,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion,
  es_plantilla_default
)
SELECT
  id,
  'Tu código de acceso a {{plataforma}}: {{codigo}}',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Tu código de acceso</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr><td style="background:#0b2d6b;padding:28px 32px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">{{plataforma}}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Código de acceso seguro</div>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Hola, {{nombre}}</p>
        <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
          Solicitaste acceso a <strong>{{plataforma}}</strong>. Usa el siguiente código o el botón para ingresar.
        </p>
        <div style="background:#f8faff;border:2px solid #1a56db;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
          <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Tu código de acceso</div>
          <div style="font-size:40px;font-weight:800;color:#0b2d6b;letter-spacing:10px;font-family:''Courier New'',monospace;">{{codigo}}</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:8px;">Válido por {{minutos_validez}} minutos · Un solo uso</div>
        </div>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="{{magic_link}}" style="display:inline-block;background:#1a56db;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
            Ingresar directamente →
          </a>
          <div style="font-size:11px;color:#9ca3af;margin-top:10px;">O copia este enlace: <span style="color:#1a56db;">{{magic_link}}</span></div>
        </div>
        <div style="background:#fef3c7;border-radius:8px;padding:14px 16px;">
          <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
            <strong>Aviso de seguridad:</strong> Si no solicitaste este acceso, ignora este mensaje. Tu cuenta permanece segura.
          </p>
        </div>
      </td></tr>
      <tr><td style="border-top:1px solid #f0f0f0;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Grupo JIRO · Sistema de acceso seguro</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>',
  ARRAY['{{nombre}}', '{{codigo}}', '{{magic_link}}', '{{plataforma}}', '{{minutos_validez}}'],
  'Tu código de acceso a {{plataforma}} es: *{{codigo}}*

También puedes ingresar aquí:
{{magic_link}}

_Este acceso vence en {{minutos_validez}} minutos._',
  ARRAY['{{nombre}}', '{{codigo}}', '{{magic_link}}', '{{plataforma}}', '{{minutos_validez}}'],
  'Código de acceso',
  'Tu código: {{codigo}} — válido {{minutos_validez}} min.',
  ARRAY['{{nombre}}', '{{codigo}}', '{{minutos_validez}}'],
  true,
  true,
  false,
  true
FROM correo_tipos_notificacion
WHERE codigo = 'acceso_passwordless';
