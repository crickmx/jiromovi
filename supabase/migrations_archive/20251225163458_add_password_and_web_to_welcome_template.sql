/*
  # Agregar contraseña y URL de página web a plantilla de Cuenta Activada

  1. Propósito
    - Agregar la variable {{password}} para enviar la contraseña al usuario
    - Agregar la variable {{pagina_web}} para enviar la URL completa de su página pública
    - Actualizar la plantilla HTML para mostrar estos datos

  2. Variables Nuevas
    - {{password}} - Contraseña del usuario (temporal, solo en email de activación)
    - {{pagina_web}} - URL completa de la página pública del usuario (ej: https://agentedeseguros.online/juan-perez)

  3. Seguridad
    - La contraseña solo se envía una vez cuando el usuario es activado
    - Se recomienda al usuario cambiarla después del primer login
*/

-- Actualizar plantilla de Cuenta Activada con las nuevas variables
UPDATE correo_plantillas
SET
  html_cuerpo = '<h2>¡Tu cuenta ha sido activada!</h2><p>Hola {{nombre}},</p><p>Tu cuenta en {{nombre_plataforma}} ha sido activada por el administrador.</p><hr><p><strong>Tus credenciales de acceso:</strong></p><p>📧 <strong>Usuario:</strong> {{email_laboral}}</p><p>🔑 <strong>Contraseña:</strong> {{password}}</p><hr><p><strong>Tu rol asignado es:</strong> {{rol}}</p><p><strong>Oficina:</strong> {{oficina}}</p><p><strong>Tu página web pública:</strong> <a href="{{pagina_web}}" target="_blank">{{pagina_web}}</a></p><hr><p style="color: #dc2626;"><strong>⚠️ Importante:</strong> Por seguridad, te recomendamos cambiar tu contraseña después del primer inicio de sesión.</p><p><a href="https://movidigital.com.mx" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Ir a la plataforma</a></p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{password}}', '{{rol}}', '{{oficina}}', '{{pagina_web}}', '{{nombre_plataforma}}'],
  whatsapp_plantilla = '¡Bienvenido {{nombre}} {{apellidos}} a {{nombre_plataforma}}! 🎉' || E'\n\n' ||
                      'Tu cuenta ha sido activada exitosamente.' || E'\n\n' ||
                      '📧 Usuario: {{email_laboral}}' || E'\n' ||
                      '🔑 Contraseña: {{password}}' || E'\n' ||
                      '👤 Rol: {{rol}}' || E'\n' ||
                      '🌐 Tu página web: {{pagina_web}}' || E'\n\n' ||
                      '⚠️ Por seguridad, cambia tu contraseña después del primer inicio de sesión.' || E'\n\n' ||
                      'Ingresa a la plataforma para comenzar.',
  whatsapp_variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{password}}', '{{rol}}', '{{oficina}}', '{{pagina_web}}', '{{nombre_plataforma}}'],
  notificacion_titulo = '¡Cuenta Activada!',
  notificacion_cuerpo = 'Tu cuenta ha sido activada. Usuario: {{email_laboral}}. Revisa tu correo para ver tu contraseña inicial.',
  notificacion_variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_laboral}}', '{{rol}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'cuenta_activada'
);

-- Comentario explicativo
COMMENT ON COLUMN correo_plantillas.variables_disponibles IS
  'Variables disponibles para usar en las plantillas. La variable {{password}} solo está disponible en la notificación de cuenta activada y debe usarse con precaución.';
