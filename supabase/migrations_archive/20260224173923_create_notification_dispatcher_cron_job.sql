/*
  # Crear Cron Job para Notification Dispatcher

  1. Configuración
    - Crear cron job que ejecute cada minuto
    - Procesa automáticamente notification_jobs pendientes
    - Usa extension pg_cron
    - Llama al edge function notification-dispatcher

  2. Seguridad
    - Usa SERVICE_ROLE_KEY para autenticación
    - Solo procesa trabajos en estado 'pending'
*/

-- Habilitar extensión pg_cron si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Eliminar cron job anterior si existe
SELECT cron.unschedule('notification-dispatcher-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notification-dispatcher-job'
);

-- Crear cron job que ejecute cada minuto
SELECT cron.schedule(
  'notification-dispatcher-job',
  '* * * * *', -- Cada minuto
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/notification-dispatcher',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Configurar parámetros de conexión (estos se deben configurar en el dashboard)
-- Por ahora los guardamos como comentarios para referencia
COMMENT ON EXTENSION pg_cron IS 'Configurar en Supabase Dashboard: 
app.settings.supabase_url = https://qhwvuuyjhcennqccgvse.supabase.co
app.settings.service_role_key = [SERVICE_ROLE_KEY]';

-- Verificar que el cron job fue creado
DO $$
DECLARE
  v_job_count integer;
BEGIN
  SELECT COUNT(*) INTO v_job_count
  FROM cron.job
  WHERE jobname = 'notification-dispatcher-job';
  
  IF v_job_count > 0 THEN
    RAISE NOTICE '✅ Cron job notification-dispatcher-job creado exitosamente';
  ELSE
    RAISE WARNING '⚠ No se pudo verificar la creación del cron job';
  END IF;
END $$;
