/*
  # Editable notifications for incoming WhatsApp messages

  Adds separate, editable events for WA MOVI (Wazzup24) and WA Personal.
  The admin UI writes correo_tipos_notificacion/correo_plantillas, while the
  delivery worker reads notification_events_catalog/transactional_notification_templates.
  Generic synchronization triggers keep both representations aligned.
*/

CREATE OR REPLACE FUNCTION sync_notification_type_to_delivery_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM notification_events_catalog WHERE event_code = NEW.codigo
  ) THEN
    UPDATE notification_events_catalog
    SET
      event_name = NEW.nombre,
      module = lower(COALESCE(NEW.modulo, 'sistema')),
      description = NEW.descripcion,
      enable_in_app = COALESCE(NEW.enviar_notificacion, false),
      enable_email = COALESCE(NEW.enviar_correo, false),
      enable_whatsapp = COALESCE(NEW.enviar_whatsapp, false),
      active = COALESCE(NEW.activo, true),
      updated_at = now()
    WHERE event_code = NEW.codigo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_notification_type_to_delivery_catalog
  ON correo_tipos_notificacion;
CREATE TRIGGER trg_sync_notification_type_to_delivery_catalog
  AFTER INSERT OR UPDATE OF nombre, descripcion, modulo, enviar_notificacion,
    enviar_correo, enviar_whatsapp, activo
  ON correo_tipos_notificacion
  FOR EACH ROW
  EXECUTE FUNCTION sync_notification_type_to_delivery_catalog();

CREATE OR REPLACE FUNCTION sync_correo_template_to_transactional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
  v_nombre text;
BEGIN
  SELECT codigo, nombre INTO v_codigo, v_nombre
  FROM correo_tipos_notificacion
  WHERE id = NEW.tipo_notificacion_id;

  IF v_codigo IS NOT NULL AND EXISTS (
    SELECT 1 FROM transactional_notification_templates WHERE event_key = v_codigo
  ) THEN
    UPDATE transactional_notification_templates
    SET
      name = v_nombre,
      email_subject_template = NEW.asunto,
      email_body_template = NEW.html_cuerpo,
      whatsapp_body_template = COALESCE(NEW.whatsapp_plantilla, ''),
      inapp_title_template = COALESCE(NEW.notificacion_titulo, ''),
      inapp_body_template = COALESCE(NEW.notificacion_cuerpo, ''),
      is_active = true,
      updated_at = now()
    WHERE event_key = v_codigo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_seguwallet_template ON correo_plantillas;
DROP TRIGGER IF EXISTS trg_sync_correo_template_to_transactional ON correo_plantillas;
CREATE TRIGGER trg_sync_correo_template_to_transactional
  AFTER INSERT OR UPDATE ON correo_plantillas
  FOR EACH ROW
  EXECUTE FUNCTION sync_correo_template_to_transactional();

INSERT INTO correo_tipos_notificacion (
  codigo, nombre, descripcion, activo, permite_destinatarios_custom,
  enviar_correo, enviar_whatsapp, enviar_notificacion, modulo,
  trigger_event, destinatario_tipo, platform
)
VALUES
  (
    'whatsapp_movi_mensaje_recibido',
    'Mensaje recibido en WA MOVI',
    'Notifica al propietario de la conversación cuando recibe un mensaje por Wazzup24 (WA MOVI).',
    true, false, false, false, true, 'WHATSAPP',
    'whatsapp_movi_message_received', 'usuario_relacionado', 'movi'
  ),
  (
    'whatsapp_personal_mensaje_recibido',
    'Mensaje recibido en WA Personal',
    'Notifica al usuario cuando recibe un mensaje en su conexión personal de WhatsApp.',
    true, false, false, false, true, 'WHATSAPP',
    'whatsapp_personal_message_received', 'usuario_relacionado', 'movi'
  )
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  modulo = EXCLUDED.modulo,
  trigger_event = EXCLUDED.trigger_event,
  destinatario_tipo = EXCLUDED.destinatario_tipo,
  platform = EXCLUDED.platform,
  es_obsoleto = false;

INSERT INTO notification_events_catalog (
  event_code, event_name, module, description,
  enable_in_app, enable_email, enable_whatsapp,
  template_in_app, template_email, template_whatsapp,
  priority, active
)
VALUES
  (
    'whatsapp_movi_mensaje_recibido',
    'Mensaje recibido en WA MOVI',
    'whatsapp',
    'Mensaje entrante de Wazzup24 para el propietario de la conversación.',
    true, false, false,
    '{"title":"Nuevo mensaje · WA MOVI","body":"{{nombre_contacto}}: {{mensaje}}"}',
    '{}', '{}', 'normal', true
  ),
  (
    'whatsapp_personal_mensaje_recibido',
    'Mensaje recibido en WA Personal',
    'whatsapp',
    'Mensaje entrante de WhatsApp personal para el dueño de la sesión.',
    true, false, false,
    '{"title":"Nuevo mensaje · WA Personal","body":"{{nombre_contacto}}: {{mensaje}}"}',
    '{}', '{}', 'normal', true
  )
ON CONFLICT (event_code) DO UPDATE SET
  event_name = EXCLUDED.event_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description,
  active = true,
  updated_at = now();

INSERT INTO transactional_notification_templates (
  event_key, name,
  email_subject_template, email_body_template,
  whatsapp_body_template,
  inapp_title_template, inapp_body_template,
  is_active, platform
)
VALUES
  (
    'whatsapp_movi_mensaje_recibido',
    'Mensaje recibido en WA MOVI',
    'Nuevo mensaje de {{nombre_contacto}} en WA MOVI',
    '<p>Recibiste un mensaje de <strong>{{nombre_contacto}}</strong> por WA MOVI.</p><p>{{mensaje}}</p>',
    'Nuevo mensaje de *{{nombre_contacto}}* en WA MOVI:\n\n{{mensaje}}',
    'Nuevo mensaje · WA MOVI',
    '{{nombre_contacto}}: {{mensaje}}',
    true, 'movi'
  ),
  (
    'whatsapp_personal_mensaje_recibido',
    'Mensaje recibido en WA Personal',
    'Nuevo mensaje de {{nombre_contacto}} en WA Personal',
    '<p>Recibiste un mensaje de <strong>{{nombre_contacto}}</strong> en WA Personal.</p><p>{{mensaje}}</p>',
    'Nuevo mensaje de *{{nombre_contacto}}* en WA Personal:\n\n{{mensaje}}',
    'Nuevo mensaje · WA Personal',
    '{{nombre_contacto}}: {{mensaje}}',
    true, 'movi'
  )
ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = true,
  updated_at = now();

INSERT INTO correo_plantillas (
  tipo_notificacion_id, asunto, html_cuerpo,
  whatsapp_plantilla, notificacion_titulo, notificacion_cuerpo,
  variables_disponibles, whatsapp_variables_disponibles,
  notificacion_variables_disponibles, es_plantilla_default
)
SELECT
  t.id,
  x.asunto,
  x.html_cuerpo,
  x.whatsapp_plantilla,
  x.notificacion_titulo,
  x.notificacion_cuerpo,
  ARRAY['{{nombre_contacto}}','{{telefono_contacto}}','{{mensaje}}','{{canal}}','{{url}}'],
  ARRAY['{{nombre_contacto}}','{{telefono_contacto}}','{{mensaje}}','{{canal}}','{{url}}'],
  ARRAY['{{nombre_contacto}}','{{telefono_contacto}}','{{mensaje}}','{{canal}}','{{url}}'],
  true
FROM (
  VALUES
    (
      'whatsapp_movi_mensaje_recibido',
      'Nuevo mensaje de {{nombre_contacto}} en WA MOVI',
      '<p>Recibiste un mensaje de <strong>{{nombre_contacto}}</strong> por WA MOVI.</p><p>{{mensaje}}</p>',
      'Nuevo mensaje de *{{nombre_contacto}}* en WA MOVI:\n\n{{mensaje}}',
      'Nuevo mensaje · WA MOVI',
      '{{nombre_contacto}}: {{mensaje}}'
    ),
    (
      'whatsapp_personal_mensaje_recibido',
      'Nuevo mensaje de {{nombre_contacto}} en WA Personal',
      '<p>Recibiste un mensaje de <strong>{{nombre_contacto}}</strong> en WA Personal.</p><p>{{mensaje}}</p>',
      'Nuevo mensaje de *{{nombre_contacto}}* en WA Personal:\n\n{{mensaje}}',
      'Nuevo mensaje · WA Personal',
      '{{nombre_contacto}}: {{mensaje}}'
    )
) AS x(codigo, asunto, html_cuerpo, whatsapp_plantilla, notificacion_titulo, notificacion_cuerpo)
JOIN correo_tipos_notificacion t ON t.codigo = x.codigo
WHERE NOT EXISTS (
  SELECT 1 FROM correo_plantillas p WHERE p.tipo_notificacion_id = t.id
);
