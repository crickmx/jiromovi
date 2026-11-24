/*
  # Arregla process_in_app_notifications: fallback a correo_plantillas + accion_url

  Encontrado al investigar por qué "llamada_perdida" (via enviar_notificacion_transaccional)
  no llegaba a la campanita: esta función (la que SÍ procesa in_app de verdad — ver nota
  de arquitectura abajo) exige una fila en notification_events_catalog y no existe ninguna
  forma de editarla desde ningún panel; si el evento no está ahí, revienta con
  "Evento no encontrado o inactivo" y el job queda failed para siempre.

  1. Fallback: si no hay fila activa en notification_events_catalog, cae a
     correo_tipos_notificacion + correo_plantillas (lo que SÍ es editable desde
     Admin > Notificaciones Transaccionales) antes de fallar.
  2. Bug de columna encontrado de paso, corregido en el mismo commit: el INSERT a
     `notificaciones` solo llenaba la columna `url` (que ningún frontend lee) y
     dejaba `accion_url` en NULL siempre — confirmado con datos reales: TODAS las
     notificaciones de tramite_actualizado/tramite_comentario_nuevo/etc. tienen
     accion_url NULL, o sea el botón "Ver" nunca ha aparecido para ninguna de
     ellas. Se agrega accion_url al INSERT (mismo valor que url, se deja url por
     si algo más lo lee, no se encontró nada en el frontend).

  ## Arquitectura (para la próxima sesión que se tope con esto)
  Hay DOS pipelines de "in_app" corriendo en paralelo cada minuto vía pg_cron,
  ambos reclamando notification_jobs.status='pending':
    - process_in_app_notifications() (esta función, Postgres/pg_cron jobid 4) —
      la que de verdad inserta en `notificaciones`. Owner real de channel='in_app'.
    - notification-dispatcher (edge function, pg_cron jobid 5 y 9 -- 9 es un
      duplicado sin el check de "hay algo pendiente" que ya hace 5, dejado sin
      tocar por ahora) — ahora solo procesa channel IN ('email','whatsapp'),
      ya no toca in_app (antes sí, como no-op silencioso; competía con esta
      función por las mismas filas sin que nadie lo supiera).
*/

CREATE OR REPLACE FUNCTION process_in_app_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_job record;
v_event record;
v_tipo record;
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

IF FOUND THEN
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
ELSE
-- Fallback: catalogo editable desde Admin > Notificaciones Transaccionales
SELECT ctn.id, cp.notificacion_titulo, cp.notificacion_cuerpo
INTO v_tipo
FROM correo_tipos_notificacion ctn
LEFT JOIN correo_plantillas cp
ON cp.tipo_notificacion_id = ctn.id AND cp.es_plantilla_default = true
WHERE ctn.codigo = v_job.event_code
AND ctn.activo = true
AND COALESCE(ctn.enviar_notificacion, true) = true;

IF NOT FOUND OR (v_tipo.notificacion_titulo IS NULL AND v_tipo.notificacion_cuerpo IS NULL) THEN
RAISE EXCEPTION 'Evento no encontrado o inactivo: %', v_job.event_code;
END IF;

v_titulo := COALESCE(v_tipo.notificacion_titulo, 'Notificacion');
v_mensaje := COALESCE(v_tipo.notificacion_cuerpo, '');
v_url := COALESCE(v_job.payload->>'url', '/dashboard');
END IF;

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
accion_url,
leida,
tipo_codigo
) VALUES (
v_job.user_id,
v_job.event_code,
v_titulo,
v_mensaje,
v_url,
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
