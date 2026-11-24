/*
  # Fix In-App Notification Variable Substitution

  1. Problem
    - The process_in_app_notifications() function only replaced a hardcoded
      list of variables (nombre, email_laboral, password, etc.)
    - Tramite-specific variables like {{folio}}, {{autor_nombre}}, {{comentario}},
      {{estatus_nuevo}}, {{estatus_anterior}}, {{modificado_por}}, {{nombre_archivo}},
      {{subido_por}}, {{campos_modificados}} were NEVER substituted
    - This caused bell notifications to show raw "{{folio}}" placeholders

  2. Solution
    - Rewrite the function to dynamically iterate over ALL keys in the
      job payload JSONB and replace every matching {{key}} placeholder
    - This matches the approach used in the notification-dispatcher edge function
    - No more hardcoded variable lists - any new variable added to payloads
      will automatically be resolved

  3. Affected notifications
    - tramite_comentario_nuevo
    - tramite_cambio_estatus
    - tramite_documento_cargado
    - tramite_actualizado
    - All future notification types that add custom variables
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

      -- Dynamically replace ALL variables from the payload
      FOR v_key, v_value IN
        SELECT key, value #>> '{}'
        FROM jsonb_each(v_job.payload)
      LOOP
        v_titulo  := replace(v_titulo,  '{{' || v_key || '}}', COALESCE(v_value, ''));
        v_mensaje := replace(v_mensaje, '{{' || v_key || '}}', COALESCE(v_value, ''));
        v_url     := replace(v_url,     '{{' || v_key || '}}', COALESCE(v_value, ''));
      END LOOP;

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

-- Also resolve the accion_url from the template (it had {{url}} placeholder too)
-- and retry any stuck/failed tramite in-app jobs so they get resolved correctly
UPDATE notification_jobs
SET
  status = 'pending',
  attempt_count = 0,
  last_error = NULL,
  next_retry_at = NULL,
  updated_at = now()
WHERE
  channel = 'in_app'
  AND status IN ('failed', 'processing')
  AND event_code IN (
    'tramite_comentario_nuevo',
    'tramite_cambio_estatus',
    'tramite_documento_cargado',
    'tramite_actualizado'
  );
