/*
  # Sistema de Tareas Automáticas de Renovación

  1. Configuración
    - Crea un cron job para ejecutar la función de tareas de renovación
    - Se ejecuta diariamente a las 7:00 AM
    - Crea notificaciones automáticas en hitos importantes (30, 15, 7 días)

  2. Funcionalidad
    - Escanea sicas_renovaciones_proximas
    - Crea tareas en CRM automáticamente
    - Envía notificaciones multi-canal
    - Evita duplicados

  3. Notas
    - Las tareas se crean con prioridad según días de vencimiento
    - Las notificaciones se envían solo en hitos específicos
    - Sistema totalmente automatizado
*/

-- Verificar extensión pg_cron (normalmente ya está habilitada en Supabase)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
END $$;

-- Programar ejecución diaria de tareas de renovación a las 7:00 AM (hora del servidor)
SELECT cron.schedule(
  'create-renewal-tasks-daily',
  '0 7 * * *', -- Todos los días a las 7:00 AM
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/create-renewal-tasks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Comentario explicativo
COMMENT ON EXTENSION pg_cron IS 'Sistema de tareas programadas para renovaciones automáticas';
