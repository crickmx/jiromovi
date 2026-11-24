/*
  # Fix Template Keys en Process In-App Notifications

  1. Problema
    - La función busca 'title' y 'message' en inglés
    - Los templates están en español: 'titulo' y 'mensaje'

  2. Solución
    - Actualizar función para buscar las claves correctas en español
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
  v_processed integer := 0;
  v_failed integer := 0;
BEGIN
  -- Procesar solo notificaciones in_app pendientes
  FOR v_job IN 
    SELECT * 
    FROM notification_jobs 
    WHERE status = 'pending' 
    AND channel = 'in_app'
    ORDER BY created_at ASC
    LIMIT 50
  LOOP
    BEGIN
      -- Marcar como procesando
      UPDATE notification_jobs 
      SET status = 'processing', updated_at = NOW()
      WHERE id = v_job.id;

      -- Obtener configuración del evento
      SELECT * INTO v_event
      FROM notification_events_catalog
      WHERE event_code = v_job.event_code;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Evento no encontrado: %', v_job.event_code;
      END IF;

      v_template := v_event.template_in_app;

      -- Extraer datos del template (soportar inglés y español)
      v_titulo := COALESCE(
        v_template->>'titulo', 
        v_template->>'title', 
        'Notificación'
      );
      
      v_mensaje := COALESCE(
        v_template->>'mensaje',
        v_template->>'message', 
        ''
      );
      
      v_url := COALESCE(v_job.payload->>'url', '/dashboard');

      -- Reemplazar variables en título
      v_titulo := replace(v_titulo, '{{nombre}}', COALESCE(v_job.payload->>'nombre', ''));
      v_titulo := replace(v_titulo, '{{nombre_completo}}', COALESCE(v_job.payload->>'nombre_completo', ''));
      v_titulo := replace(v_titulo, '{{apellidos}}', COALESCE(v_job.payload->>'apellidos', ''));
      
      -- Reemplazar variables en mensaje
      v_mensaje := replace(v_mensaje, '{{nombre}}', COALESCE(v_job.payload->>'nombre', ''));
      v_mensaje := replace(v_mensaje, '{{apellidos}}', COALESCE(v_job.payload->>'apellidos', ''));
      v_mensaje := replace(v_mensaje, '{{nombre_completo}}', COALESCE(v_job.payload->>'nombre_completo', ''));
      v_mensaje := replace(v_mensaje, '{{email_laboral}}', COALESCE(v_job.payload->>'email_laboral', ''));
      v_mensaje := replace(v_mensaje, '{{email}}', COALESCE(v_job.payload->>'email_laboral', v_job.payload->>'email', ''));
      v_mensaje := replace(v_mensaje, '{{password}}', COALESCE(v_job.payload->>'password', ''));
      v_mensaje := replace(v_mensaje, '{{pagina_web}}', COALESCE(v_job.payload->>'pagina_web', ''));
      v_mensaje := replace(v_mensaje, '{{rol}}', COALESCE(v_job.payload->>'rol', ''));
      v_mensaje := replace(v_mensaje, '{{oficina}}', COALESCE(v_job.payload->>'oficina', ''));
      v_mensaje := replace(v_mensaje, '{{puesto}}', COALESCE(v_job.payload->>'puesto', ''));

      -- Insertar notificación
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

      -- Marcar como enviado
      UPDATE notification_jobs 
      SET 
        status = 'sent',
        sent_at = NOW(),
        updated_at = NOW()
      WHERE id = v_job.id;

      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Marcar como fallido con el error
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

COMMENT ON FUNCTION process_in_app_notifications IS 
  'Procesa automáticamente los notification_jobs pendientes de tipo in_app (campanita). Ejecutado por cron cada minuto. Soporta templates en español e inglés.';
