/*
  # Fix Process In-App Notifications - Corregir Schema

  1. Problema
    - La función process_in_app_notifications intenta insertar columna "icono" que no existe
    - La tabla notificaciones no tiene esa columna

  2. Solución
    - Actualizar función para usar solo columnas existentes
    - Usar "tipo" en lugar de "icono"
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

      -- Extraer datos del template
      v_titulo := COALESCE(v_template->>'title', 'Notificación');
      v_mensaje := COALESCE(v_template->>'message', '');
      v_url := COALESCE(v_job.payload->>'url', '/dashboard');

      -- Reemplazar variables en título y mensaje
      v_titulo := replace(v_titulo, '{{nombre}}', COALESCE(v_job.payload->>'nombre', ''));
      v_titulo := replace(v_titulo, '{{nombre_completo}}', COALESCE(v_job.payload->>'nombre_completo', ''));
      
      v_mensaje := replace(v_mensaje, '{{nombre}}', COALESCE(v_job.payload->>'nombre', ''));
      v_mensaje := replace(v_mensaje, '{{nombre_completo}}', COALESCE(v_job.payload->>'nombre_completo', ''));
      v_mensaje := replace(v_mensaje, '{{email_laboral}}', COALESCE(v_job.payload->>'email_laboral', ''));
      v_mensaje := replace(v_mensaje, '{{password}}', COALESCE(v_job.payload->>'password', ''));
      v_mensaje := replace(v_mensaje, '{{pagina_web}}', COALESCE(v_job.payload->>'pagina_web', ''));
      v_mensaje := replace(v_mensaje, '{{rol}}', COALESCE(v_job.payload->>'rol', ''));

      -- Insertar notificación (sin columna icono)
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
      -- Marcar como fallido
      UPDATE notification_jobs 
      SET 
        status = 'failed',
        last_error = SQLERRM,
        attempt_count = attempt_count + 1,
        updated_at = NOW()
      WHERE id = v_job.id;

      v_failed := v_failed + 1;
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
  'Procesa automáticamente los notification_jobs pendientes de tipo in_app (campanita). Ejecutado por cron cada minuto.';
