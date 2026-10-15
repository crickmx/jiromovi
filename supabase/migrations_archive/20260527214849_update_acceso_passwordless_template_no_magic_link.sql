/*
  # Actualizar plantilla acceso_passwordless — sin magic link

  ## Cambios
  - Plantilla de correo HTML: solo muestra el código de 6 caracteres, sin enlace mágico
  - Plantilla de WhatsApp: solo el código, sin URL
  - Variables: {{nombre}}, {{codigo}}, {{plataforma}}, {{minutos_validez}}
*/

UPDATE correo_tipos_notificacion
SET descripcion = 'Enviado cuando un usuario solicita acceso mediante código de verificación de 6 caracteres'
WHERE codigo = 'acceso_passwordless';

UPDATE correo_plantillas
SET
  asunto = 'Tu código de acceso a {{plataforma}}: {{codigo}}',
  html_cuerpo = '
<div style="background:#0b2d6b;padding:28px 32px;text-align:center;margin:-32px -32px 0 -32px;">
  <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">{{plataforma}}</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Código de acceso seguro</div>
</div>
<div style="padding:32px 0 0 0;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Hola, {{nombre}}</p>
  <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
    Solicitaste acceso a <strong>{{plataforma}}</strong>. Usa el siguiente código para ingresar desde la pantalla de inicio de sesión.
  </p>
  <div style="background:#f8faff;border:2px solid #1a56db;border-radius:12px;padding:28px 24px;text-align:center;margin-bottom:28px;">
    <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;">Tu código de acceso</div>
    <div style="font-size:42px;font-weight:800;color:#0b2d6b;letter-spacing:12px;font-family:''Courier New'',monospace;line-height:1;">{{codigo}}</div>
    <div style="font-size:12px;color:#9ca3af;margin-top:12px;">Válido por {{minutos_validez}} minutos · Un solo uso</div>
  </div>
  <div style="background:#fef3c7;border-radius:8px;padding:14px 16px;">
    <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
      <strong>Aviso de seguridad:</strong> Si no solicitaste este acceso, ignora este mensaje. Tu cuenta permanece segura.
    </p>
  </div>
  <p style="margin:24px 0 0;font-size:11px;color:#d1d5db;text-align:center;">
    Grupo JIRO · Sistema de acceso seguro
  </p>
</div>',
  whatsapp_plantilla = 'Tu código de acceso a *{{plataforma}}* es:

*{{codigo}}*

_Válido por {{minutos_validez}} minutos. Un solo uso._'
WHERE tipo_notificacion_id = (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'acceso_passwordless'
);
