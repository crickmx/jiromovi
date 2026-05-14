/*
  # Fix all notification URLs to use absolute domain

  1. Changes
    - Updates all notification functions that build relative URLs (/tramites/..., /dashboard, etc.)
      to use the full domain: https://app.movi.digital
    - Adds a safety net in process_in_app_notifications to prepend the domain for any remaining 
      relative URLs starting with /
    - Fixes notify_ticket_changes which inserts directly into notifications table
    - Fixes enviar_notificacion_completa to prepend domain on relative accion_url
    - Fixes trigger_send_welcome_on_activation, send_welcome_notifications_on_activation,
      handle_new_user_notification, handle_user_activation_notification

  2. Affected Functions
    - notificar_actualizacion_tramite
    - notificar_cambio_estatus_tramite
    - notificar_comentario_tramite
    - notificar_documento_tramite
    - notify_ticket_changes
    - generate_ticket_notification_url
    - handle_new_user_notification
    - handle_user_activation_notification
    - send_welcome_notifications_on_activation
    - trigger_send_welcome_on_activation
    - enviar_notificacion_completa
    - process_in_app_notifications (safety net)

  3. Important Notes
    - All links sent in emails, WhatsApp, and in-app notifications will now include the full 
      https://app.movi.digital prefix
    - The only function that was already correct was notificar_equipos_nuevo_usuario
*/

-- Helper: ensure_absolute_url function for reuse
CREATE OR REPLACE FUNCTION ensure_absolute_url(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_url IS NULL OR p_url = '' THEN
    RETURN 'https://app.movi.digital/dashboard';
  END IF;
  
  IF p_url LIKE 'http://%' OR p_url LIKE 'https://%' THEN
    RETURN p_url;
  END IF;
  
  IF p_url LIKE '/%' THEN
    RETURN 'https://app.movi.digital' || p_url;
  END IF;
  
  RETURN 'https://app.movi.digital/' || p_url;
END;
$$;

-- 1. Fix notificar_actualizacion_tramite
CREATE OR REPLACE FUNCTION notificar_actualizacion_tramite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_modificador RECORD;
v_estatus_nombre TEXT;
v_campos_modificados TEXT[];
v_variables jsonb;
BEGIN
v_campos_modificados := ARRAY[]::TEXT[];

IF OLD.tipo_tramite IS DISTINCT FROM NEW.tipo_tramite THEN
v_campos_modificados := array_append(v_campos_modificados, 'Tipo de trámite');
END IF;

IF OLD.prioridad IS DISTINCT FROM NEW.prioridad THEN
v_campos_modificados := array_append(v_campos_modificados, 'Prioridad');
END IF;

IF OLD.poliza IS DISTINCT FROM NEW.poliza THEN
v_campos_modificados := array_append(v_campos_modificados, 'Póliza');
END IF;

IF OLD.instrucciones IS DISTINCT FROM NEW.instrucciones THEN
v_campos_modificados := array_append(v_campos_modificados, 'Instrucciones');
END IF;

IF OLD.assigned_to_user_id IS DISTINCT FROM NEW.assigned_to_user_id THEN
v_campos_modificados := array_append(v_campos_modificados, 'Responsable');
END IF;

IF array_length(v_campos_modificados, 1) IS NULL THEN
RETURN NEW;
END IF;

SELECT nombre_completo, rol INTO v_modificador
FROM usuarios WHERE id = NEW.modificado_por;

SELECT nombre INTO v_estatus_nombre
FROM ticket_estatus WHERE id = NEW.estatus_id;

v_variables := jsonb_build_object(
'folio',              NEW.folio,
'agente_nombre',      '',
'modificado_por',     COALESCE(v_modificador.nombre_completo, 'Sistema'),
'rol_modificador',    COALESCE(v_modificador.rol, ''),
'campos_modificados', array_to_string(v_campos_modificados, ', '),
'tipo_tramite',       COALESCE(NEW.tipo_tramite, ''),
'estatus',            COALESCE(v_estatus_nombre, 'Sin estatus'),
'instrucciones',      COALESCE(NEW.instrucciones, ''),
'url',                'https://app.movi.digital/tramites/' || NEW.id
);

PERFORM notify_tramite_recipients(
p_ticket_id       := NEW.id,
p_codigo_tipo     := 'tramite_actualizado',
p_variables       := v_variables,
p_excluir_user_id := NEW.modificado_por
);

RETURN NEW;
END;
$$;

-- 2. Fix notificar_cambio_estatus_tramite
CREATE OR REPLACE FUNCTION notificar_cambio_estatus_tramite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_modificador RECORD;
v_estatus_anterior TEXT;
v_estatus_nuevo TEXT;
v_variables jsonb;
BEGIN
IF OLD.estatus_id IS NOT DISTINCT FROM NEW.estatus_id THEN
RETURN NEW;
END IF;

SELECT nombre_completo, rol INTO v_modificador
FROM usuarios WHERE id = NEW.modificado_por;

SELECT nombre INTO v_estatus_anterior
FROM ticket_estatus WHERE id = OLD.estatus_id;

SELECT nombre INTO v_estatus_nuevo
FROM ticket_estatus WHERE id = NEW.estatus_id;

v_variables := jsonb_build_object(
'folio',            NEW.folio,
'agente_nombre',    '',
'estatus_anterior', COALESCE(v_estatus_anterior, 'Sin estatus'),
'estatus_nuevo',    COALESCE(v_estatus_nuevo, 'Sin estatus'),
'modificado_por',   COALESCE(v_modificador.nombre_completo, 'Sistema'),
'rol_modificador',  COALESCE(v_modificador.rol, ''),
'tipo_tramite',     COALESCE(NEW.tipo_tramite, ''),
'instrucciones',    COALESCE(NEW.instrucciones, ''),
'url',              'https://app.movi.digital/tramites/' || NEW.id
);

PERFORM notify_tramite_recipients(
p_ticket_id       := NEW.id,
p_codigo_tipo     := 'tramite_cambio_estatus',
p_variables       := v_variables,
p_excluir_user_id := NEW.modificado_por
);

RETURN NEW;
END;
$$;

-- 3. Fix notificar_comentario_tramite
CREATE OR REPLACE FUNCTION notificar_comentario_tramite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_tramite RECORD;
v_autor RECORD;
v_variables jsonb;
BEGIN
SELECT t.id, t.folio, t.tipo_tramite, t.estatus_id, t.instrucciones,
te.nombre AS estatus_nombre
INTO v_tramite
FROM tickets t
LEFT JOIN ticket_estatus te ON te.id = t.estatus_id
WHERE t.id = NEW.ticket_id;

IF NOT FOUND THEN
RETURN NEW;
END IF;

SELECT nombre_completo, rol INTO v_autor
FROM usuarios WHERE id = NEW.usuario_id;

v_variables := jsonb_build_object(
'folio',         v_tramite.folio,
'agente_nombre', '',
'comentario',    NEW.mensaje,
'autor_nombre',  COALESCE(v_autor.nombre_completo, 'Usuario'),
'autor_rol',     COALESCE(v_autor.rol, ''),
'tipo_tramite',  COALESCE(v_tramite.tipo_tramite, ''),
'estatus',       COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
'instrucciones', COALESCE(v_tramite.instrucciones, ''),
'url',           'https://app.movi.digital/tramites/' || v_tramite.id
);

PERFORM notify_tramite_recipients(
p_ticket_id       := NEW.ticket_id,
p_codigo_tipo     := 'tramite_comentario_nuevo',
p_variables       := v_variables,
p_excluir_user_id := NEW.usuario_id
);

RETURN NEW;
END;
$$;

-- 4. Fix notificar_documento_tramite
CREATE OR REPLACE FUNCTION notificar_documento_tramite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_tramite RECORD;
v_subidor RECORD;
v_tamano_texto TEXT;
v_variables jsonb;
BEGIN
SELECT t.id, t.folio, t.tipo_tramite, t.instrucciones,
te.nombre AS estatus_nombre
INTO v_tramite
FROM tickets t
LEFT JOIN ticket_estatus te ON te.id = t.estatus_id
WHERE t.id = NEW.ticket_id;

IF NOT FOUND THEN
RETURN NEW;
END IF;

SELECT nombre_completo, rol INTO v_subidor
FROM usuarios WHERE id = NEW.usuario_id;

IF NEW.tamano IS NOT NULL THEN
IF NEW.tamano < 1024 THEN
v_tamano_texto := NEW.tamano || ' bytes';
ELSIF NEW.tamano < 1048576 THEN
v_tamano_texto := ROUND(NEW.tamano / 1024.0, 2) || ' KB';
ELSE
v_tamano_texto := ROUND(NEW.tamano / 1048576.0, 2) || ' MB';
END IF;
ELSE
v_tamano_texto := 'Desconocido';
END IF;

v_variables := jsonb_build_object(
'folio',          v_tramite.folio,
'agente_nombre',  '',
'nombre_archivo', NEW.nombre,
'subido_por',     COALESCE(v_subidor.nombre_completo, 'Usuario'),
'rol_subidor',    COALESCE(v_subidor.rol, ''),
'tamano_archivo', v_tamano_texto,
'tipo_tramite',   COALESCE(v_tramite.tipo_tramite, ''),
'estatus',        COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
'instrucciones',  COALESCE(v_tramite.instrucciones, ''),
'url',            'https://app.movi.digital/tramites/' || v_tramite.id
);

PERFORM notify_tramite_recipients(
p_ticket_id       := NEW.ticket_id,
p_codigo_tipo     := 'tramite_documento_cargado',
p_variables       := v_variables,
p_excluir_user_id := NEW.usuario_id
);

RETURN NEW;
END;
$$;

-- 5. Fix notify_ticket_changes
CREATE OR REPLACE FUNCTION notify_ticket_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_notification_title text;
v_notification_body text;
v_notification_url text;
v_target_user_id uuid;
v_changed_by_name text;
v_status_changed boolean := false;
v_reassigned boolean := false;
BEGIN
SELECT nombre_completo INTO v_changed_by_name
FROM usuarios
WHERE id = NEW.modificado_por;

v_changed_by_name := COALESCE(v_changed_by_name, 'Sistema');

v_notification_url := 'https://app.movi.digital/tramites/' || NEW.id;

IF TG_OP = 'UPDATE' THEN
IF OLD.estatus_id IS DISTINCT FROM NEW.estatus_id THEN
v_status_changed := true;
v_notification_title := 'Actualización de trámite';

DECLARE
v_new_status_name text;
BEGIN
SELECT nombre INTO v_new_status_name
FROM ticket_estatus
WHERE id = NEW.estatus_id;

v_notification_body := format('Tu trámite %s cambió a estatus: %s', NEW.folio, v_new_status_name);
END;
END IF;

IF OLD.assigned_to_user_id IS DISTINCT FROM NEW.assigned_to_user_id THEN
v_reassigned := true;
v_notification_title := 'Trámite asignado';
v_notification_body := format('Se te asignó el trámite %s', NEW.folio);

IF NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_to_user_id != NEW.modificado_por THEN
INSERT INTO notifications (
user_id,
title,
body,
link_url,
is_read
) VALUES (
NEW.assigned_to_user_id,
v_notification_title,
v_notification_body,
v_notification_url,
false
);
END IF;

IF OLD.assigned_to_user_id IS NOT NULL AND OLD.assigned_to_user_id != NEW.modificado_por THEN
INSERT INTO notifications (
user_id,
title,
body,
link_url,
is_read
) VALUES (
OLD.assigned_to_user_id,
'Trámite reasignado',
format('El trámite %s fue reasignado a otro usuario', NEW.folio),
v_notification_url,
false
);
END IF;
END IF;

IF NOT v_status_changed AND NOT v_reassigned THEN
v_notification_title := 'Tu trámite fue actualizado';
v_notification_body := format('Tu trámite %s fue actualizado por %s', NEW.folio, v_changed_by_name);
END IF;

v_target_user_id := NEW.assigned_to_user_id;

IF v_target_user_id IS NOT NULL AND v_target_user_id != NEW.modificado_por AND (v_status_changed OR (NOT v_reassigned)) THEN
INSERT INTO notifications (
user_id,
title,
body,
link_url,
is_read
) VALUES (
v_target_user_id,
v_notification_title,
v_notification_body,
v_notification_url,
false
);
END IF;
END IF;

RETURN NEW;
END;
$$;

-- 6. Fix generate_ticket_notification_url
CREATE OR REPLACE FUNCTION generate_ticket_notification_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
IF NEW.titulo LIKE '%trámite%' AND NEW.accion_url IS NULL THEN
DECLARE
folio_match TEXT;
ticket_id_found UUID;
BEGIN
folio_match := (regexp_matches(NEW.mensaje, 'TK[A-Z0-9]+'))[1];

IF folio_match IS NOT NULL THEN
SELECT id INTO ticket_id_found
FROM tickets
WHERE folio = folio_match
LIMIT 1;

IF ticket_id_found IS NOT NULL THEN
NEW.accion_url := 'https://app.movi.digital/tramites/' || ticket_id_found;
END IF;
END IF;
END;
END IF;

RETURN NEW;
END;
$$;

-- 7. Fix handle_new_user_notification
CREATE OR REPLACE FUNCTION handle_new_user_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagina_web text;
  v_oficina_nombre text := 'No asignada';
BEGIN
  IF NEW.estado = 'activo' AND OLD IS NULL THEN
    IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
      v_pagina_web := 'https://agentedeseguros.website/' || NEW.web_slug;
    ELSE
      v_pagina_web := 'No configurada';
    END IF;

    IF NEW.oficina_id IS NOT NULL THEN
      SELECT nombre INTO v_oficina_nombre
      FROM oficinas
      WHERE id = NEW.oficina_id;
    END IF;

    PERFORM enviar_notificacion_completa(
      p_tipo_codigo := 'cuenta_activada',
      p_user_id := NEW.id,
      p_titulo := '¡Bienvenido a MOVI Digital!',
      p_mensaje := 'Tu cuenta ha sido activada exitosamente.',
      p_modulo := 'usuarios',
      p_datos_adicionales := jsonb_build_object(
        'email_laboral', NEW.email_laboral,
        'rol', NEW.rol,
        'oficina', v_oficina_nombre,
        'pagina_web', v_pagina_web,
        'puesto', COALESCE(NEW.puesto, '')
      ),
      p_accion_url := 'https://app.movi.digital/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 8. Fix handle_user_activation_notification
CREATE OR REPLACE FUNCTION handle_user_activation_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagina_web text;
  v_oficina_nombre text := 'No asignada';
BEGIN
  IF OLD.estado = 'pendiente' AND NEW.estado = 'activo' THEN
    IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
      v_pagina_web := 'https://agentedeseguros.website/' || NEW.web_slug;
    ELSE
      v_pagina_web := 'No configurada';
    END IF;

    IF NEW.oficina_id IS NOT NULL THEN
      SELECT nombre INTO v_oficina_nombre
      FROM oficinas
      WHERE id = NEW.oficina_id;
    END IF;

    PERFORM enviar_notificacion_completa(
      p_tipo_codigo := 'cuenta_activada',
      p_user_id := NEW.id,
      p_titulo := '¡Bienvenido a MOVI Digital!',
      p_mensaje := 'Tu cuenta ha sido activada exitosamente.',
      p_modulo := 'usuarios',
      p_datos_adicionales := jsonb_build_object(
        'email_laboral', NEW.email_laboral,
        'rol', NEW.rol,
        'oficina', v_oficina_nombre,
        'pagina_web', v_pagina_web,
        'puesto', COALESCE(NEW.puesto, '')
      ),
      p_accion_url := 'https://app.movi.digital/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 9. Fix send_welcome_notifications_on_activation
CREATE OR REPLACE FUNCTION send_welcome_notifications_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_pagina_web text;
v_oficina_nombre text;
v_password_temp text;
BEGIN
IF NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo') THEN
RAISE LOG '[activation] Usuario activado: % - %', NEW.id, NEW.email_laboral;

IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
v_pagina_web := 'https://agentedeseguros.website/' || NEW.web_slug;
ELSE
v_pagina_web := 'No configurada aún';
END IF;

IF NEW.oficina_id IS NOT NULL THEN
SELECT nombre INTO v_oficina_nombre
FROM oficinas
WHERE id = NEW.oficina_id;
END IF;

IF v_oficina_nombre IS NULL THEN
v_oficina_nombre := 'No asignada';
END IF;

v_password_temp := 'La que te proporcionó tu administrador';

BEGIN
PERFORM enviar_notificacion_completa(
p_tipo_codigo := 'cuenta_activada',
p_user_id := NEW.id,
p_titulo := '¡Bienvenido a MOVI Digital!',
p_mensaje := 'Tu cuenta ha sido activada exitosamente. Ya puedes acceder a la plataforma.',
p_modulo := 'usuarios',
p_datos_adicionales := jsonb_build_object(
'nombre', COALESCE(NEW.nombre_completo, NEW.nombre || ' ' || NEW.apellidos),
'email_laboral', NEW.email_laboral,
'password', v_password_temp,
'pagina_web', v_pagina_web,
'oficina', v_oficina_nombre,
'rol', NEW.rol
),
p_accion_url := 'https://app.movi.digital/dashboard'
);
RAISE LOG '[activation] Notificación de cuenta_activada enviada correctamente';
EXCEPTION WHEN OTHERS THEN
RAISE LOG '[activation] Error al enviar notificación: %', SQLERRM;
END;
END IF;

RETURN NEW;
END;
$$;

-- 10. Fix trigger_send_welcome_on_activation
CREATE OR REPLACE FUNCTION trigger_send_welcome_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_oficina_nombre text;
v_pagina_web text;
v_recent_job boolean;
v_activation_key text;
BEGIN
IF NOT (NEW.estado = 'activo' AND (OLD.estado IS NULL OR OLD.estado != 'activo')) THEN
RETURN NEW;
END IF;

SELECT EXISTS(
SELECT 1 FROM notification_jobs
WHERE event_code = 'cuenta_activada'
AND user_id = NEW.id
AND created_at > NOW() - INTERVAL '5 minutes'
LIMIT 1
) INTO v_recent_job;

IF v_recent_job THEN
RAISE NOTICE '[ACTIVATION TRIGGER] Job reciente detectado para %, omitiendo duplicado', NEW.id;
RETURN NEW;
END IF;

IF NEW.oficina_id IS NOT NULL THEN
SELECT nombre INTO v_oficina_nombre
FROM oficinas
WHERE id = NEW.oficina_id;
END IF;

IF v_oficina_nombre IS NULL THEN
v_oficina_nombre := 'No asignada';
END IF;

IF NEW.web_slug IS NOT NULL AND NEW.web_slug != '' THEN
v_pagina_web := 'https://agentedeseguros.website/' || NEW.web_slug;
ELSE
v_pagina_web := 'No configurada aún';
END IF;

v_activation_key := NEW.id::text || '_' || extract(epoch from NOW())::bigint::text;

BEGIN
PERFORM notify(
'cuenta_activada',
ARRAY[NEW.id],
jsonb_build_object(
'nombre', COALESCE(NEW.nombre, ''),
'apellidos', COALESCE(NEW.apellidos, ''),
'nombre_completo', COALESCE(NEW.nombre_completo, TRIM(COALESCE(NEW.nombre, '') || ' ' || COALESCE(NEW.apellidos, ''))),
'email_laboral', NEW.email_laboral,
'email_personal', COALESCE(NEW.email_personal, ''),
'celular_laboral', COALESCE(NEW.celular_laboral, ''),
'celular_personal', COALESCE(NEW.celular_personal, ''),
'password', 'La contraseña que configuraste',
'rol', NEW.rol,
'oficina', v_oficina_nombre,
'puesto', COALESCE(NEW.puesto, 'Sin asignar'),
'pagina_web', v_pagina_web,
'url', 'https://app.movi.digital/dashboard'
),
v_activation_key
);
RAISE NOTICE '[ACTIVATION TRIGGER] Notificación cuenta_activada enviada para usuario %', NEW.id;
EXCEPTION WHEN OTHERS THEN
RAISE WARNING '[ACTIVATION TRIGGER] Error al enviar notificación: %', SQLERRM;
END;

RETURN NEW;
END;
$$;

-- 11. Fix enviar_notificacion_completa to ensure absolute URLs
CREATE OR REPLACE FUNCTION enviar_notificacion_completa(
p_tipo_codigo text,
p_user_id uuid,
p_titulo text,
p_mensaje text,
p_modulo text DEFAULT 'general',
p_datos_adicionales jsonb DEFAULT '{}'::jsonb,
p_accion_url text DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_result jsonb;
v_notif_ids uuid[] := ARRAY[]::uuid[];
v_payload jsonb;
v_absolute_url text;
BEGIN
v_absolute_url := ensure_absolute_url(COALESCE(p_accion_url, '/dashboard'));

v_payload := p_datos_adicionales || jsonb_build_object(
'titulo', p_titulo,
'mensaje', p_mensaje,
'modulo', p_modulo,
'url', v_absolute_url
);

SELECT notify(
p_tipo_codigo,
ARRAY[p_user_id],
v_payload,
NULL
) INTO v_result;

RAISE LOG '[enviar_notificacion_completa] Resultado de notify(): %', v_result;

RETURN v_notif_ids;

EXCEPTION WHEN OTHERS THEN
RAISE WARNING '[enviar_notificacion_completa] Error: %', SQLERRM;
RETURN v_notif_ids;
END;
$$;

-- 12. Fix process_in_app_notifications to ensure absolute URLs as safety net
CREATE OR REPLACE FUNCTION process_in_app_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_job record;
v_event record;
v_template jsonb;
v_titulo text;
v_mensaje text;
v_url text;
v_key text;
v_value text;
v_processed integer := 0;
v_failed integer := 0;
BEGIN
FOR v_job IN 
SELECT * 
FROM notification_jobs 
WHERE status = 'pending' 
AND channel = 'in_app'
ORDER BY created_at ASC
LIMIT 50
LOOP
BEGIN
UPDATE notification_jobs 
SET status = 'processing', updated_at = NOW()
WHERE id = v_job.id;

SELECT * INTO v_event
FROM notification_events_catalog
WHERE event_code = v_job.event_code
AND active = true;

IF NOT FOUND THEN
RAISE EXCEPTION 'Evento no encontrado o inactivo: %', v_job.event_code;
END IF;

v_template := v_event.template_in_app;

v_titulo := COALESCE(
v_template->>'titulo', 
v_template->>'title', 
'Notificacion'
);

v_mensaje := COALESCE(
v_template->>'mensaje',
v_template->>'message', 
''
);

v_url := COALESCE(
v_template->>'accion_url',
v_job.payload->>'url',
'/dashboard'
);

FOR v_key, v_value IN
SELECT key, value #>> '{}'
FROM jsonb_each(v_job.payload)
LOOP
v_titulo  := replace(v_titulo,  '{{' || v_key || '}}', COALESCE(v_value, ''));
v_mensaje := replace(v_mensaje, '{{' || v_key || '}}', COALESCE(v_value, ''));
v_url     := replace(v_url,     '{{' || v_key || '}}', COALESCE(v_value, ''));
END LOOP;

-- Safety net: ensure URL is absolute
v_url := ensure_absolute_url(v_url);

INSERT INTO notificaciones (
usuario_id,
tipo,
titulo,
mensaje,
url,
leida,
tipo_codigo
) VALUES (
v_job.user_id,
v_job.event_code,
v_titulo,
v_mensaje,
v_url,
false,
v_job.event_code
);

UPDATE notification_jobs 
SET 
status = 'sent',
sent_at = NOW(),
updated_at = NOW()
WHERE id = v_job.id;

v_processed := v_processed + 1;

EXCEPTION WHEN OTHERS THEN
UPDATE notification_jobs 
SET 
status = 'failed',
last_error = SQLERRM,
attempt_count = attempt_count + 1,
updated_at = NOW()
WHERE id = v_job.id;

v_failed := v_failed + 1;

RAISE WARNING 'Error procesando job %: %', v_job.id, SQLERRM;
END;
END LOOP;

RETURN jsonb_build_object(
'success', true,
'processed', v_processed,
'failed', v_failed
);
END;
$$;

-- 13. Fix any existing relative URLs in the notificaciones table
UPDATE notificaciones
SET url = 'https://app.movi.digital' || url
WHERE url LIKE '/%'
AND url NOT LIKE 'http%';

-- 14. Fix any existing relative URLs in the notifications table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    EXECUTE 'UPDATE notifications SET link_url = ''https://app.movi.digital'' || link_url WHERE link_url LIKE ''/%'' AND link_url NOT LIKE ''http%''';
  END IF;
END $$;
