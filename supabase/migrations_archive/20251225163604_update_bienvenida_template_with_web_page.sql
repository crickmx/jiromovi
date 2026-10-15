/*
  # Actualizar plantilla de Bienvenida con página web

  1. Propósito
    - Actualizar la plantilla de bienvenida para incluir la URL de página web
    - Mantener consistencia con la plantilla de cuenta_activada

  2. Variables
    - Agregar {{pagina_web}} a las plantillas de bienvenida
*/

-- Actualizar plantilla de Bienvenida
UPDATE correo_plantillas
SET
  html_cuerpo = '<h2>¡Bienvenido {{nombre}} {{apellidos}}!</h2><p>Tu cuenta ha sido creada exitosamente en {{nombre_plataforma}}.</p><hr><p><strong>Información de tu cuenta:</strong></p><p>📧 <strong>Email Laboral:</strong> {{email_laboral}}</p><p>📧 <strong>Email Personal:</strong> {{email_personal}}</p><p>👤 <strong>Rol:</strong> {{rol}}</p><p>🏢 <strong>Oficina:</strong> {{oficina}}</p><p>🌐 <strong>Tu página web pública:</strong> <a href="{{pagina_web}}" target="_blank">{{pagina_web}}</a></p><hr><p>Ingresa a la plataforma para comenzar.</p><p><a href="https://movidigital.com.mx" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Ir a la plataforma</a></p>',
  variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_personal}}', '{{email_laboral}}', '{{celular_personal}}', '{{celular_laboral}}', '{{rol}}', '{{puesto}}', '{{oficina}}', '{{pagina_web}}', '{{nombre_plataforma}}'],
  whatsapp_plantilla = '¡Bienvenido {{nombre}} {{apellidos}} a {{nombre_plataforma}}! 🎉' || E'\n\n' ||
                      'Tu cuenta ha sido creada exitosamente.' || E'\n\n' ||
                      '📧 Email Laboral: {{email_laboral}}' || E'\n' ||
                      '👤 Rol: {{rol}}' || E'\n' ||
                      '🏢 Oficina: {{oficina}}' || E'\n' ||
                      '🌐 Tu página web: {{pagina_web}}' || E'\n\n' ||
                      'Ingresa a la plataforma para comenzar.',
  whatsapp_variables_disponibles = ARRAY['{{nombre}}', '{{apellidos}}', '{{email_personal}}', '{{email_laboral}}', '{{rol}}', '{{oficina}}', '{{pagina_web}}', '{{nombre_plataforma}}'],
  ultima_actualizacion = now()
WHERE tipo_notificacion_id IN (
  SELECT id FROM correo_tipos_notificacion WHERE codigo = 'bienvenida'
);
