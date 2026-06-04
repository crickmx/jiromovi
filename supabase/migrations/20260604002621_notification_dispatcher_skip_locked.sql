/*
  # Fix 3: Dispatcher con FOR UPDATE SKIP LOCKED para evitar procesamiento doble

  ## Problema
  El notification-dispatcher procesa pending jobs con:
    1. SELECT * FROM notification_jobs WHERE status = 'pending'
    2. UPDATE ... SET status = 'processing' (por cada job)
  
  Si dos instancias corren simultáneamente (CRON cada 60s con ejecución >60s),
  ambas pueden ver los mismos 'pending' jobs y procesarlos dos veces.

  ## Solución
  Crear una función RPC `claim_notification_jobs(batch_size)` que usa:
  - `SELECT ... FOR UPDATE SKIP LOCKED` para selección atómica
  - UPDATE en la misma transacción
  - Devuelve solo los jobs que pudo reclamar exclusivamente
  
  El dispatcher llama a esta RPC en lugar del SELECT directo.
  Jobs reclamados por otra instancia son automáticamente saltados (SKIP LOCKED).

  ## Columnas adicionales
  - processing_started_at: cuándo empezó a procesarse (ya agregada en Fix 1)
  - Timeout de limpieza: jobs en 'processing' por más de 5 min se regresan a 'pending'
    (por si una instancia murió a la mitad)
*/

-- ============================================================
-- PASO 1: Función claim_notification_jobs con SKIP LOCKED
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_notification_jobs(p_batch_size int DEFAULT 50)
RETURNS TABLE (
  id               uuid,
  event_code       text,
  user_id          uuid,
  channel          text,
  status           text,
  payload          jsonb,
  attempt_count    int,
  max_attempts     int,
  idempotency_key  text,
  attachments      jsonb,
  created_at       timestamptz,
  updated_at       timestamptz,
  next_retry_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Primero: reciclar jobs atascados en 'processing' por más de 5 minutos
  -- (instancia que murió a la mitad)
  UPDATE notification_jobs
  SET
    status               = 'pending',
    processing_started_at = NULL,
    updated_at           = NOW()
  WHERE status = 'processing'
    AND processing_started_at IS NOT NULL
    AND processing_started_at < NOW() - INTERVAL '5 minutes'
    AND attempt_count < COALESCE(max_attempts, 3);

  -- Reclamar jobs usando FOR UPDATE SKIP LOCKED (atómico, sin race condition)
  RETURN QUERY
  WITH claimed AS (
    SELECT nj.id
    FROM notification_jobs nj
    WHERE nj.status = 'pending'
      AND (nj.next_retry_at IS NULL OR nj.next_retry_at <= NOW())
    ORDER BY nj.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE notification_jobs j
  SET
    status                = 'processing',
    processing_started_at = NOW(),
    updated_at            = NOW()
  FROM claimed
  WHERE j.id = claimed.id
  RETURNING
    j.id,
    j.event_code,
    j.user_id,
    j.channel,
    j.status,
    j.payload,
    j.attempt_count,
    j.max_attempts,
    j.idempotency_key,
    j.attachments,
    j.created_at,
    j.updated_at,
    j.next_retry_at;
END;
$$;

-- Permisos para service role
GRANT EXECUTE ON FUNCTION public.claim_notification_jobs(int) TO service_role;

-- ============================================================
-- PASO 2: Función de limpieza de jobs fallidos/expirados
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_stale_notification_jobs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recycled int;
  v_failed   int;
BEGIN
  -- Reciclar processing atascados > 5 min con reintentos disponibles
  UPDATE notification_jobs
  SET
    status                = 'pending',
    processing_started_at = NULL,
    updated_at            = NOW()
  WHERE status = 'processing'
    AND processing_started_at < NOW() - INTERVAL '5 minutes'
    AND attempt_count < COALESCE(max_attempts, 3);

  GET DIAGNOSTICS v_recycled = ROW_COUNT;

  -- Marcar como failed los que superaron max_attempts y siguen atascados
  UPDATE notification_jobs
  SET
    status     = 'failed',
    last_error = 'Excedió reintentos máximos o tiempo de procesamiento',
    updated_at = NOW()
  WHERE status = 'processing'
    AND processing_started_at < NOW() - INTERVAL '10 minutes';

  GET DIAGNOSTICS v_failed = ROW_COUNT;

  IF v_recycled > 0 OR v_failed > 0 THEN
    RAISE NOTICE '[NOTIFICATION CLEANUP] Reciclados: %, Fallidos definitivos: %',
      v_recycled, v_failed;
  END IF;

  RETURN v_recycled + v_failed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_notification_jobs() TO service_role;

-- ============================================================
-- PASO 3: Índices para performance del dispatcher
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notification_jobs_claim
  ON notification_jobs(status, created_at, next_retry_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_jobs_stale_processing
  ON notification_jobs(status, processing_started_at)
  WHERE status = 'processing';
