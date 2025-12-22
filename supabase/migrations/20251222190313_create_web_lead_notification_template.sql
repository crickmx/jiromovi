/*
  # Plantilla de Notificación para Leads desde Mi Página Web

  1. Nueva Plantilla
    - event_key: `web_lead_nuevo`
    - Canales: Email, WhatsApp, Campanita (in-app)
    - Variables: agent_name, client_name, client_phone, client_email, insurance_type

  2. Seguridad
    - La plantilla es editable solo por administradores
    - Las notificaciones se envían automáticamente al recibir un lead

  Este sistema convierte Mi Página Web en una máquina de generación de leads automática
*/

-- Insertar plantilla de notificación para nuevos leads web
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
  'web_lead_nuevo',
  'Nuevo Lead desde Mi Página Web',
  '🎯 Nuevo Lead desde Tu Página Web',
  '<p>Hola <strong>{{agent_name}}</strong>,</p>
<br>
<p>¡Excelente noticia! Tienes un nuevo prospecto desde tu página web.</p>
<br>
<h3>📋 Datos del prospecto:</h3>
<ul>
  <li><strong>Nombre:</strong> {{client_name}}</li>
  <li><strong>Celular:</strong> {{client_phone}}</li>
  <li><strong>Email:</strong> {{client_email}}</li>
  <li><strong>Seguro de interés:</strong> {{insurance_type}}</li>
</ul>
<br>
<h3>✅ Acciones realizadas automáticamente:</h3>
<ul>
  <li>Contacto creado en tu CRM</li>
  <li>Tarea de seguimiento asignada</li>
</ul>
<br>
<p>💡 <strong>Siguiente paso:</strong> Contacta al cliente lo antes posible para aprovechar su interés.</p>
<br>
<p>Accede a tu CRM para ver todos los detalles y comenzar el seguimiento.</p>
<br>
<p>---<br>
<em>Powered by MOVI Digital</em></p>',
  '🎯 *Nuevo Lead desde Tu Página Web*

Hola {{agent_name}},

¡Tienes un nuevo prospecto!

📋 *Datos del prospecto:*
• Nombre: {{client_name}}
• Celular: {{client_phone}}
• Email: {{client_email}}
• Seguro: {{insurance_type}}

✅ Ya creamos el contacto en tu CRM y una tarea de seguimiento.

💡 *Acción:* Contacta al cliente lo antes posible.',
  'Nuevo Lead: {{client_name}}',
  '¡Nuevo prospecto desde tu página web! {{client_name}} está interesado en {{insurance_type}}. Celular: {{client_phone}}, Email: {{client_email}}. Ya creamos el contacto y una tarea en tu CRM.',
  true
) ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  inapp_title_template = EXCLUDED.inapp_title_template,
  inapp_body_template = EXCLUDED.inapp_body_template,
  is_active = EXCLUDED.is_active,
  updated_at = now();
