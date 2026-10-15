/*
  # Repair Existing Broken Tramite Notifications

  1. Problem
    - 41 existing in-app notifications have raw {{variable}} placeholders
      because process_in_app_notifications() previously only substituted
      a hardcoded list of variables (nombre, email, etc.) and missed
      all tramite-specific variables (folio, autor_nombre, comentario, etc.)

  2. Solution
    - Match each broken notification to its source notification_job via
      user_id, event_code, and timestamp proximity
    - Re-render titulo and mensaje using the payload stored in the job
    - Also fix the url/accion_url from the payload
    - Delete notifications that cannot be matched to a job (orphans)
*/

DO $$
DECLARE
  v_notif record;
  v_job record;
  v_template jsonb;
  v_titulo text;
  v_mensaje text;
  v_url text;
  v_key text;
  v_value text;
  v_fixed integer := 0;
  v_deleted integer := 0;
BEGIN
  FOR v_notif IN
    SELECT n.id, n.usuario_id, n.tipo_codigo, n.created_at
    FROM notificaciones n
    WHERE n.tipo_codigo IN (
      'tramite_comentario_nuevo',
      'tramite_cambio_estatus',
      'tramite_documento_cargado',
      'tramite_actualizado'
    )
    AND (n.titulo LIKE '%{{%' OR n.mensaje LIKE '%{{%')
  LOOP
    -- Find the matching job by user, event code, and closest timestamp
    SELECT j.* INTO v_job
    FROM notification_jobs j
    WHERE j.user_id = v_notif.usuario_id
    AND j.event_code = v_notif.tipo_codigo
    AND j.channel = 'in_app'
    AND j.status = 'sent'
    AND ABS(EXTRACT(EPOCH FROM (j.sent_at - v_notif.created_at))) < 120
    ORDER BY ABS(EXTRACT(EPOCH FROM (j.sent_at - v_notif.created_at)))
    LIMIT 1;

    IF NOT FOUND THEN
      -- Try matching by created_at proximity instead
      SELECT j.* INTO v_job
      FROM notification_jobs j
      WHERE j.user_id = v_notif.usuario_id
      AND j.event_code = v_notif.tipo_codigo
      AND j.channel = 'in_app'
      AND ABS(EXTRACT(EPOCH FROM (j.created_at - v_notif.created_at))) < 300
      ORDER BY ABS(EXTRACT(EPOCH FROM (j.created_at - v_notif.created_at)))
      LIMIT 1;
    END IF;

    IF NOT FOUND THEN
      -- Cannot repair, remove the broken notification
      DELETE FROM notificaciones WHERE id = v_notif.id;
      v_deleted := v_deleted + 1;
      CONTINUE;
    END IF;

    -- Get the template from catalog
    SELECT template_in_app INTO v_template
    FROM notification_events_catalog
    WHERE event_code = v_notif.tipo_codigo;

    IF v_template IS NULL THEN
      DELETE FROM notificaciones WHERE id = v_notif.id;
      v_deleted := v_deleted + 1;
      CONTINUE;
    END IF;

    v_titulo := COALESCE(v_template->>'titulo', v_template->>'title', 'Notificacion');
    v_mensaje := COALESCE(v_template->>'mensaje', v_template->>'message', '');
    v_url := COALESCE(v_template->>'accion_url', v_job.payload->>'url', '/dashboard');

    -- Dynamically replace all variables from the payload
    FOR v_key, v_value IN
      SELECT key, value #>> '{}'
      FROM jsonb_each(v_job.payload)
    LOOP
      v_titulo  := replace(v_titulo,  '{{' || v_key || '}}', COALESCE(v_value, ''));
      v_mensaje := replace(v_mensaje, '{{' || v_key || '}}', COALESCE(v_value, ''));
      v_url     := replace(v_url,     '{{' || v_key || '}}', COALESCE(v_value, ''));
    END LOOP;

    UPDATE notificaciones
    SET titulo = v_titulo,
        mensaje = v_mensaje,
        url = v_url,
        accion_url = v_url
    WHERE id = v_notif.id;

    v_fixed := v_fixed + 1;
  END LOOP;

  RAISE NOTICE 'Repaired % notifications, deleted % unmatched', v_fixed, v_deleted;
END;
$$;
