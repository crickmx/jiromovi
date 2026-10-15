/*
  # Crear cron job para procesar notificaciones automáticamente

  1. Cambios
    - Habilitar extensión pg_cron si no está habilitada
    - Crear job que ejecute notification-dispatcher cada minuto
    - Procesar trabajos pendientes automáticamente

  2. Funcionamiento
    - El cron ejecuta cada 60 segundos
    - Invoca el edge function notification-dispatcher
    - Procesa todos los trabajos pendientes
*/

-- Habilitar pg_cron si no está habilitado
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Eliminar job anterior si existe
SELECT cron.unschedule('process-notification-jobs') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-notification-jobs'
);

-- Crear job para procesar notificaciones cada minuto
SELECT cron.schedule(
  'process-notification-jobs',
  '* * * * *', -- Cada minuto
  $$
  SELECT
    net.http_post(
      url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/notification-dispatcher',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjA5OTAsImV4cCI6MjA3NzI5Njk5MH0.bIlGsgeAC6oxGUalODg0C5-l6KaJip0wWa9IbQ7MjTQ"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Job scheduler para tareas automatizadas en Postgres';
