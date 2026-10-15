/*
  # Fix Notification Dispatcher Cron - Versión Simple

  1. Problema
    - El cron anterior requiere parámetros de configuración externos
    - Necesitamos una solución que funcione directamente

  2. Solución
    - Crear función PL/pgSQL que procese directamente los jobs
    - Evitar dependencia de HTTP calls externos
    - Procesar in_app, email y WhatsApp internamente

  3. Notas
    - Para email y WhatsApp se seguirá usando el edge function
    - Para in_app (campanita) se inserta directo en la tabla notificaciones
*/

-- Eliminar cron anterior
SELECT cron.unschedule('notification-dispatcher-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notification-dispatcher-job'
);

-- Crear función que procese jobs de notificaciones in-app (campanita)
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
  v_icono text;
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
      v_icono := COALESCE(v_template->>'icon', 'bell');
      v_url := COALESCE(v_job.payload->>'url', '/dashboard');

      -- Reemplazar variables en título y mensaje
      v_titulo := replace(v_titulo, '{{nombre}}', COALESCE(v_job.payload->>'nombre', ''));
      v_titulo := replace(v_titulo, '{{nombre_completo}}', COALESCE(v_job.payload->>'nombre_completo', ''));
      
      v_mensaje := replace(v_mensaje, '{{nombre}}', COALESCE(v_job.payload->>'nombre', ''));
      v_mensaje := replace(v_mensaje, '{{nombre_completo}}', COALESCE(v_job.payload->>'nombre_completo', ''));
      v_mensaje := replace(v_mensaje, '{{email_laboral}}', COALESCE(v_job.payload->>'email_laboral', ''));
      v_mensaje := replace(v_mensaje, '{{password}}', COALESCE(v_job.payload->>'password', ''));
      v_mensaje := replace(v_mensaje, '{{pagina_web}}', COALESCE(v_job.payload->>'pagina_web', ''));

      -- Insertar notificación
      INSERT INTO notificaciones (
        usuario_id,
        tipo,
        titulo,
        mensaje,
        icono,
        url,
        leida
      ) VALUES (
        v_job.user_id,
        v_job.event_code,
        v_titulo,
        v_mensaje,
        v_icono,
        v_url,
        false
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

-- Crear cron job simple que ejecute la función local
SELECT cron.schedule(
  'process-in-app-notifications',
  '* * * * *', -- Cada minuto
  $$SELECT process_in_app_notifications();$$
);

-- Para email y WhatsApp, crear función que invoque el dispatcher vía pg_net
CREATE OR REPLACE FUNCTION trigger_notification_dispatcher()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count integer;
  v_supabase_url text;
BEGIN
  -- Contar trabajos pendientes de email y whatsapp
  SELECT COUNT(*) INTO v_pending_count
  FROM notification_jobs
  WHERE status = 'pending'
  AND channel IN ('email', 'whatsapp');

  IF v_pending_count = 0 THEN
    RETURN;
  END IF;

  -- Obtener URL de Supabase desde env
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  
  IF v_supabase_url IS NULL THEN
    -- Usar URL hardcodeada como fallback
    v_supabase_url := 'https://qhwvuuyjhcennqccgvse.supabase.co';
  END IF;

  -- Llamar al edge function usando pg_net
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/notification-dispatcher',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

EXCEPTION WHEN OTHERS THEN
  -- Ignorar errores silenciosamente para no romper el cron
  RAISE WARNING 'Error al invocar notification-dispatcher: %', SQLERRM;
END;
$$;

-- Crear cron job para email y WhatsApp
SELECT cron.schedule(
  'trigger-notification-dispatcher',
  '* * * * *', -- Cada minuto
  $$SELECT trigger_notification_dispatcher();$$
);

-- Verificar creación de cron jobs
DO $$
DECLARE
  v_jobs_count integer;
BEGIN
  SELECT COUNT(*) INTO v_jobs_count
  FROM cron.job
  WHERE jobname IN ('process-in-app-notifications', 'trigger-notification-dispatcher');
  
  RAISE NOTICE '✅ % cron jobs creados para procesamiento de notificaciones', v_jobs_count;
END $$;
