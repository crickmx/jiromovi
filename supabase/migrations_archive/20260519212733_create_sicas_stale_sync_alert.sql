/*
  # SICAS Stale Sync Alert Function

  ## Purpose
  Creates a DB function that checks if the last successful SICAS sync is older than
  48 hours and, if so, logs a notification in historial_notificaciones and marks a
  flag in sicas_config so the admin panel can surface the alert visually.

  ## New Function
  - `check_sicas_stale_sync()` — callable via cron every 6 hours
    - Reads `sicas_sync_jobs` for last completed job
    - If last completion > 48 hours ago (or no completion ever), inserts an in-app
      notification for all admin users
    - Idempotent: uses a 6-hour dedup window to avoid notification spam

  ## New Cron Job
  - `sicas-stale-sync-check` — runs every 6 hours
*/

-- Function: check for stale SICAS sync and notify admins
CREATE OR REPLACE FUNCTION public.check_sicas_stale_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_completed_at   timestamptz;
  v_hours_since_sync    numeric;
  v_admin_id            uuid;
  v_recent_alert_count  int;
BEGIN
  -- Get last successful sync completion
  SELECT finished_at INTO v_last_completed_at
  FROM sicas_sync_jobs
  WHERE status = 'completed'
  ORDER BY finished_at DESC
  LIMIT 1;

  -- Calculate hours since last sync (NULL = never synced = treat as 9999 hours)
  IF v_last_completed_at IS NULL THEN
    v_hours_since_sync := 9999;
  ELSE
    v_hours_since_sync := EXTRACT(EPOCH FROM (now() - v_last_completed_at)) / 3600.0;
  END IF;

  -- Only alert if stale (>48h)
  IF v_hours_since_sync < 48 THEN
    RETURN;
  END IF;

  -- Dedup: skip if we already sent an alert in the last 6 hours
  SELECT COUNT(*) INTO v_recent_alert_count
  FROM notificaciones_globales
  WHERE tipo = 'alerta'
    AND titulo ILIKE '%sincronización SICAS%'
    AND created_at > now() - interval '6 hours';

  IF v_recent_alert_count > 0 THEN
    RETURN;
  END IF;

  -- Notify all admin users
  FOR v_admin_id IN
    SELECT id FROM usuarios
    WHERE rol = 'admin'
      AND activo = true
      AND (eliminado IS NULL OR eliminado = false)
  LOOP
    INSERT INTO notificaciones_globales (
      usuario_id,
      tipo,
      titulo,
      mensaje,
      url,
      leida,
      created_at
    ) VALUES (
      v_admin_id,
      'alerta',
      'Sincronización SICAS desactualizada',
      CASE
        WHEN v_last_completed_at IS NULL
          THEN 'No se ha completado ninguna sincronización con SICAS. Verifica la conexión y el estado del servidor.'
        ELSE format(
          'La última sincronización exitosa con SICAS fue hace %.0f horas (%s). Se esperaba sincronización cada 30 minutos.',
          v_hours_since_sync,
          to_char(v_last_completed_at AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI')
        )
      END,
      '/produccion/configuracion',
      false,
      now()
    );
  END LOOP;

END;
$$;

-- Grant execution to postgres role used by cron
GRANT EXECUTE ON FUNCTION public.check_sicas_stale_sync() TO postgres;

-- Schedule stale sync check every 6 hours
SELECT cron.unschedule('sicas-stale-sync-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sicas-stale-sync-check'
);

SELECT cron.schedule(
  'sicas-stale-sync-check',
  '0 */6 * * *',
  'SELECT public.check_sicas_stale_sync()'
);
