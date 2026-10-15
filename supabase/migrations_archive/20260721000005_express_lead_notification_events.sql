/*
  # seguros.express — Eventos de notificación transaccional (Parte F)

  Reutiliza el sistema transaccional existente (correo_tipos_notificacion +
  notification_events_catalog + transactional_notification_templates +
  correo_plantillas, con los triggers de sincronización ya existentes).

  Eventos:
    1. express_lead_nuevo (platform 'movi') — INTERNO: al agente "hay un lead
       cerca". Se dispara con send_transactional_notification(event_key, agente_id,
       vars, url) → bell + email + WhatsApp; el push VAPID lo agrega la edge
       function. NO incluye datos de contacto (se revelan sólo al tomar el lead).
    2. express_lead_confirmacion_visitante (platform 'seguwallet') — EXTERNO:
       confirmación al visitante que dejó sus datos en la landing. La edge function
       renderiza esta plantilla y la envía con identidad Seguwallet.

  (La notificación de "lead tomado" al agente y la de "sin match" al Admin usan
   enviar_notificacion_individual directo desde el RPC/edge function — mismo
   patrón que Trámites — así que no necesitan plantilla propia.)

  Idempotente vía ON CONFLICT. Mismo recetario que
  20260718000001_whatsapp_incoming_notification_templates.sql.
*/

-- 1) correo_tipos_notificacion (lado editable en admin)
INSERT INTO public.correo_tipos_notificacion (
  codigo, nombre, descripcion, activo, permite_destinatarios_custom,
  enviar_correo, enviar_whatsapp, enviar_notificacion, modulo,
  trigger_event, destinatario_tipo, platform
)
VALUES
  (
    'express_lead_nuevo',
    'seguros.express — Nuevo lead cerca',
    'Avisa a los agentes habilitados cuando entra un lead de seguros.express dentro de su alcance. No incluye datos de contacto (se revelan al tomar el lead).',
    true, false, true, true, true, 'CRM',
    'express_lead_nuevo', 'usuario_relacionado', 'movi'
  ),
  (
    'express_lead_confirmacion_visitante',
    'seguros.express — Confirmación al visitante',
    'Confirmación con identidad Seguwallet al visitante que solicitó una cotización en seguros.express.',
    true, true, true, true, false, 'SEGUWALLET',
    'express_lead_confirmacion_visitante', 'externo', 'seguwallet'
  )
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  modulo = EXCLUDED.modulo,
  trigger_event = EXCLUDED.trigger_event,
  destinatario_tipo = EXCLUDED.destinatario_tipo,
  platform = EXCLUDED.platform,
  es_obsoleto = false;

-- 2) notification_events_catalog (lado worker de entrega)
INSERT INTO public.notification_events_catalog (
  event_code, event_name, module, description,
  enable_in_app, enable_email, enable_whatsapp,
  template_in_app, template_email, template_whatsapp,
  priority, active
)
VALUES
  (
    'express_lead_nuevo',
    'seguros.express — Nuevo lead cerca',
    'crm',
    'Lead de seguros.express dentro del alcance del agente.',
    true, true, true,
    '{"title":"Nuevo lead cerca · seguros.express","body":"Hay un lead de {{tipo_seguro}} cerca de ti. Tómalo para ver sus datos."}',
    '{}', '{}', 'high', true
  ),
  (
    'express_lead_confirmacion_visitante',
    'seguros.express — Confirmación al visitante',
    'seguwallet',
    'Confirmación de solicitud de cotización enviada al visitante.',
    false, true, true,
    '{}', '{}', '{}', 'normal', true
  )
ON CONFLICT (event_code) DO UPDATE SET
  event_name = EXCLUDED.event_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description,
  active = true,
  updated_at = now();

-- 3) transactional_notification_templates (plantillas del worker)
INSERT INTO public.transactional_notification_templates (
  event_key, name,
  email_subject_template, email_body_template,
  whatsapp_body_template,
  inapp_title_template, inapp_body_template,
  is_active, platform
)
VALUES
  (
    'express_lead_nuevo',
    'seguros.express — Nuevo lead cerca',
    'Nuevo lead de {{tipo_seguro}} cerca de ti',
    '<p>Entró un nuevo lead de <strong>{{tipo_seguro}}</strong> en seguros.express{{ubicacion_frase}}.</p><p>Entra a <strong>Mi CRM → Mis Leads seguros.express</strong> para tomarlo antes que otro agente y ver sus datos de contacto.</p>',
    'Nuevo lead de *{{tipo_seguro}}* cerca de ti en seguros.express{{ubicacion_frase}}. Entra a Mi CRM → Mis Leads seguros.express para tomarlo.',
    'Nuevo lead cerca · seguros.express',
    'Hay un lead de {{tipo_seguro}} cerca de ti. Tómalo para ver sus datos.',
    true, 'movi'
  ),
  (
    'express_lead_confirmacion_visitante',
    'seguros.express — Confirmación al visitante',
    'Recibimos tu solicitud de cotización',
    '<p>Hola {{nombre}},</p><p>Recibimos tu solicitud de cotización de <strong>{{tipo_seguro}}</strong>. Un asesor cercano te contactará muy pronto.</p><p>Gracias por confiar en nosotros.</p>',
    'Hola {{nombre}}, recibimos tu solicitud de cotización de *{{tipo_seguro}}*. Un asesor cercano te contactará muy pronto.',
    '',
    '',
    true, 'seguwallet'
  )
ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = true,
  updated_at = now();

-- 4) correo_plantillas (plantilla editable ligada al tipo)
INSERT INTO public.correo_plantillas (
  tipo_notificacion_id, asunto, html_cuerpo,
  whatsapp_plantilla, notificacion_titulo, notificacion_cuerpo,
  variables_disponibles, whatsapp_variables_disponibles,
  notificacion_variables_disponibles, es_plantilla_default
)
SELECT
  t.id, x.asunto, x.html_cuerpo, x.whatsapp_plantilla,
  x.notificacion_titulo, x.notificacion_cuerpo,
  x.vars, x.vars, x.vars, true
FROM (
  VALUES
    (
      'express_lead_nuevo',
      'Nuevo lead de {{tipo_seguro}} cerca de ti',
      '<p>Entró un nuevo lead de <strong>{{tipo_seguro}}</strong> en seguros.express{{ubicacion_frase}}.</p><p>Entra a <strong>Mi CRM → Mis Leads seguros.express</strong> para tomarlo antes que otro agente y ver sus datos de contacto.</p>',
      'Nuevo lead de *{{tipo_seguro}}* cerca de ti en seguros.express{{ubicacion_frase}}. Entra a Mi CRM → Mis Leads seguros.express para tomarlo.',
      'Nuevo lead cerca · seguros.express',
      'Hay un lead de {{tipo_seguro}} cerca de ti. Tómalo para ver sus datos.',
      ARRAY['{{tipo_seguro}}','{{ubicacion_frase}}','{{distancia_km}}','{{url}}']
    ),
    (
      'express_lead_confirmacion_visitante',
      'Recibimos tu solicitud de cotización',
      '<p>Hola {{nombre}},</p><p>Recibimos tu solicitud de cotización de <strong>{{tipo_seguro}}</strong>. Un asesor cercano te contactará muy pronto.</p><p>Gracias por confiar en nosotros.</p>',
      'Hola {{nombre}}, recibimos tu solicitud de cotización de *{{tipo_seguro}}*. Un asesor cercano te contactará muy pronto.',
      '',
      '',
      ARRAY['{{nombre}}','{{tipo_seguro}}']
    )
) AS x(codigo, asunto, html_cuerpo, whatsapp_plantilla, notificacion_titulo, notificacion_cuerpo, vars)
JOIN public.correo_tipos_notificacion t ON t.codigo = x.codigo
WHERE NOT EXISTS (
  SELECT 1 FROM public.correo_plantillas p WHERE p.tipo_notificacion_id = t.id
);
