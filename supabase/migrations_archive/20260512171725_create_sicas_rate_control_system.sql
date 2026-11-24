/*
  # SICAS Rate Control & Audit System

  1. New Tables
    - `sicas_api_call_logs` - Audit log for every SICAS API call
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable - system calls have no user)
      - `delivery_id` (uuid, nullable - for policy delivery operations)
      - `process_type` (text - sync, register, verify, search, catalog, report)
      - `module` (text - documents, commissions, receivables, clients, catalogs)
      - `method` (text - SOAP/REST)
      - `endpoint` (text)
      - `soap_action` (text, nullable)
      - `key_process` (text, nullable)
      - `key_code` (text, nullable)
      - `tproc` (text, nullable)
      - `conditions_hash` (text, nullable - hash of filter conditions)
      - `request_preview_redacted` (text, nullable - first 500 chars, no passwords)
      - `response_status` (integer, nullable)
      - `response_success` (boolean)
      - `response_message` (text, nullable)
      - `response_time_ms` (integer, nullable)
      - `retry_count` (integer, default 0)
      - `was_cached` (boolean, default false)
      - `was_rate_limited` (boolean, default false)
      - `was_blocked` (boolean, default false)
      - `error_code` (text, nullable)
      - `error_message` (text, nullable)
      - `created_at` (timestamptz)

    - `sicas_process_locks` - Mutex/concurrency control for SICAS operations
      - `id` (uuid, primary key)
      - `lock_type` (text - sync_massive, register_document, create_client, sync_catalogs)
      - `lock_key` (text - unique identifier for the specific lock)
      - `is_active` (boolean, default true)
      - `started_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `process_type` (text)
      - `user_id` (uuid, nullable)
      - `metadata` (jsonb, nullable)
      - `created_at` (timestamptz)

    - `sicas_circuit_breaker` - Circuit breaker state per tenant
      - `id` (uuid, primary key)
      - `is_open` (boolean, default false - open means BLOCKED)
      - `opened_at` (timestamptz, nullable)
      - `closes_at` (timestamptz, nullable)
      - `error_count_5min` (integer, default 0)
      - `timeout_count_5min` (integer, default 0)
      - `last_error_at` (timestamptz, nullable)
      - `last_success_at` (timestamptz, nullable)
      - `reason` (text, nullable)
      - `updated_at` (timestamptz)

    - `sicas_request_cache` - Cache for SICAS responses
      - `id` (uuid, primary key)
      - `cache_key` (text, unique)
      - `module` (text)
      - `operation` (text)
      - `response_data` (jsonb)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)

    - `sicas_rate_config` - Admin-configurable rate limits
      - `id` (uuid, primary key)
      - `config_key` (text, unique)
      - `config_value` (text)
      - `description` (text)
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, nullable)

  2. Security
    - Enable RLS on all tables
    - Admin-only policies for configuration
    - Service role access for edge functions

  3. Indexes
    - Index on sicas_api_call_logs(created_at) for recent queries
    - Index on sicas_process_locks(lock_type, lock_key, is_active)
    - Index on sicas_request_cache(cache_key, expires_at)

  4. Default Configuration Values
    - Safe defaults that prevent saturation
*/

-- 1. API Call Logs
CREATE TABLE IF NOT EXISTS sicas_api_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delivery_id uuid,
  process_type text NOT NULL DEFAULT 'unknown',
  module text NOT NULL DEFAULT 'unknown',
  method text NOT NULL DEFAULT 'SOAP',
  endpoint text,
  soap_action text,
  key_process text,
  key_code text,
  tproc text,
  type_format text,
  conditions_hash text,
  request_preview_redacted text,
  response_status integer,
  response_success boolean DEFAULT false,
  response_message text,
  response_time_ms integer,
  retry_count integer DEFAULT 0,
  was_cached boolean DEFAULT false,
  was_rate_limited boolean DEFAULT false,
  was_blocked boolean DEFAULT false,
  error_code text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_api_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all SICAS logs"
  ON sicas_api_call_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Service role can insert SICAS logs"
  ON sicas_api_call_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sicas_api_call_logs_created_at
  ON sicas_api_call_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sicas_api_call_logs_module_type
  ON sicas_api_call_logs(module, process_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sicas_api_call_logs_delivery
  ON sicas_api_call_logs(delivery_id)
  WHERE delivery_id IS NOT NULL;

-- 2. Process Locks
CREATE TABLE IF NOT EXISTS sicas_process_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_type text NOT NULL,
  lock_key text NOT NULL,
  is_active boolean DEFAULT true,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  process_type text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_process_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage SICAS locks"
  ON sicas_process_locks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Authenticated users can view active locks"
  ON sicas_process_locks FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_sicas_process_locks_active
  ON sicas_process_locks(lock_type, lock_key, is_active)
  WHERE is_active = true;

-- 3. Circuit Breaker
CREATE TABLE IF NOT EXISTS sicas_circuit_breaker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_open boolean DEFAULT false,
  opened_at timestamptz,
  closes_at timestamptz,
  error_count_5min integer DEFAULT 0,
  timeout_count_5min integer DEFAULT 0,
  last_error_at timestamptz,
  last_success_at timestamptz,
  reason text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_circuit_breaker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view circuit breaker"
  ON sicas_circuit_breaker FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage circuit breaker"
  ON sicas_circuit_breaker FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'superadmin')
    )
  );

-- Insert single circuit breaker row
INSERT INTO sicas_circuit_breaker (is_open, error_count_5min, timeout_count_5min)
VALUES (false, 0, 0)
ON CONFLICT DO NOTHING;

-- 4. Request Cache
CREATE TABLE IF NOT EXISTS sicas_request_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  module text NOT NULL,
  operation text NOT NULL,
  response_data jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_request_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages cache"
  ON sicas_request_cache FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sicas_request_cache_key_expires
  ON sicas_request_cache(cache_key, expires_at);

-- 5. Rate Configuration
CREATE TABLE IF NOT EXISTS sicas_rate_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE sicas_rate_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rate config"
  ON sicas_rate_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage rate config"
  ON sicas_rate_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'superadmin')
    )
  );

-- Insert default configuration values
INSERT INTO sicas_rate_config (config_key, config_value, description) VALUES
  ('SICAS_USE_REST', 'false', 'Habilitar API REST de SICAS (actualmente devuelve 404)'),
  ('SICAS_ENABLE_AUTO_RETRIES', 'false', 'Habilitar reintentos automaticos para operaciones de escritura'),
  ('MAX_RETRIES_READ', '2', 'Maximo de reintentos para operaciones de lectura'),
  ('MAX_RETRIES_WRITE', '0', 'Maximo de reintentos para operaciones de escritura'),
  ('MAX_CONCURRENT_REQUESTS', '3', 'Maximo de llamadas concurrentes a SICAS'),
  ('MASSIVE_SYNC_CONCURRENCY', '1', 'Maximo de sincronizaciones masivas simultaneas'),
  ('MIN_DELAY_BETWEEN_REQUESTS_MS', '500', 'Pausa minima entre llamadas individuales (ms)'),
  ('REPORT_PAGE_DELAY_MS', '1500', 'Pausa entre paginas de reportes (ms)'),
  ('VERIFY_CACHE_MINUTES', '10', 'Cache de verificacion de documentos (minutos)'),
  ('SEARCH_CACHE_MINUTES', '10', 'Cache de busqueda por poliza (minutos)'),
  ('CATALOG_CACHE_HOURS', '24', 'Cache de catalogos (horas)'),
  ('REPORT_CACHE_MINUTES', '15', 'Cache de reportes de produccion (minutos)'),
  ('TIMEOUT_SIMPLE_MS', '20000', 'Timeout para consultas simples (ms)'),
  ('TIMEOUT_REPORT_MS', '45000', 'Timeout para reportes (ms)'),
  ('TIMEOUT_MASSIVE_MS', '90000', 'Timeout para procesos masivos por bloque (ms)'),
  ('CIRCUIT_BREAKER_ERROR_THRESHOLD', '5', 'Errores 500 en 5 min para activar circuit breaker'),
  ('CIRCUIT_BREAKER_TIMEOUT_THRESHOLD', '3', 'Timeouts en 5 min para activar circuit breaker'),
  ('CIRCUIT_BREAKER_PAUSE_MINUTES', '15', 'Minutos de pausa cuando circuit breaker se activa'),
  ('BATCH_SIZE', '50', 'Tamano de lote para procesos masivos'),
  ('BATCH_DELAY_MS', '2000', 'Pausa entre lotes (ms)'),
  ('MAX_PAGES_PER_EXECUTION', '20', 'Maximo de paginas por ejecucion de sync'),
  ('MAX_JOB_DURATION_MINUTES', '5', 'Duracion maxima por job (minutos)'),
  ('LOCK_EXPIRY_MINUTES', '10', 'Tiempo maximo de bloqueo antes de permitir desbloqueo manual'),
  ('USER_COOLDOWN_MINUTES', '2', 'Tiempo minimo entre reintentos del usuario (minutos)')
ON CONFLICT (config_key) DO NOTHING;

-- 6. Helper function to get config value
CREATE OR REPLACE FUNCTION get_sicas_config(p_key text, p_default text DEFAULT '')
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT config_value FROM sicas_rate_config WHERE config_key = p_key),
    p_default
  );
$$;

-- 7. Helper function to acquire a process lock
CREATE OR REPLACE FUNCTION acquire_sicas_lock(
  p_lock_type text,
  p_lock_key text,
  p_process_type text,
  p_user_id uuid DEFAULT NULL,
  p_duration_minutes integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_lock_id uuid;
BEGIN
  -- Expire old locks
  UPDATE sicas_process_locks
  SET is_active = false
  WHERE lock_type = p_lock_type
    AND lock_key = p_lock_key
    AND is_active = true
    AND expires_at < now();

  -- Check for active lock
  SELECT * INTO v_existing
  FROM sicas_process_locks
  WHERE lock_type = p_lock_type
    AND lock_key = p_lock_key
    AND is_active = true
    AND expires_at >= now()
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'lock_active',
      'existing_lock_id', v_existing.id,
      'started_at', v_existing.started_at,
      'expires_at', v_existing.expires_at,
      'process_type', v_existing.process_type
    );
  END IF;

  -- Acquire lock
  INSERT INTO sicas_process_locks (lock_type, lock_key, process_type, user_id, expires_at)
  VALUES (p_lock_type, p_lock_key, p_process_type, p_user_id, now() + (p_duration_minutes || ' minutes')::interval)
  RETURNING id INTO v_lock_id;

  RETURN jsonb_build_object(
    'acquired', true,
    'lock_id', v_lock_id
  );
END;
$$;

-- 8. Helper function to release a process lock
CREATE OR REPLACE FUNCTION release_sicas_lock(p_lock_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sicas_process_locks
  SET is_active = false
  WHERE id = p_lock_id;
$$;

-- 9. Function to check and update circuit breaker
CREATE OR REPLACE FUNCTION check_sicas_circuit_breaker()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state record;
BEGIN
  SELECT * INTO v_state FROM sicas_circuit_breaker LIMIT 1;

  IF v_state IS NULL THEN
    INSERT INTO sicas_circuit_breaker (is_open, error_count_5min, timeout_count_5min)
    VALUES (false, 0, 0)
    RETURNING * INTO v_state;
  END IF;

  -- If open and past close time, auto-close
  IF v_state.is_open AND v_state.closes_at IS NOT NULL AND v_state.closes_at <= now() THEN
    UPDATE sicas_circuit_breaker
    SET is_open = false, error_count_5min = 0, timeout_count_5min = 0, updated_at = now()
    WHERE id = v_state.id;

    RETURN jsonb_build_object('is_open', false, 'reason', 'auto_closed');
  END IF;

  RETURN jsonb_build_object(
    'is_open', v_state.is_open,
    'reason', v_state.reason,
    'closes_at', v_state.closes_at,
    'error_count_5min', v_state.error_count_5min,
    'timeout_count_5min', v_state.timeout_count_5min
  );
END;
$$;

-- 10. Function to record an error and potentially trip circuit breaker
CREATE OR REPLACE FUNCTION record_sicas_error(p_is_timeout boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state record;
  v_error_threshold integer;
  v_timeout_threshold integer;
  v_pause_minutes integer;
BEGIN
  SELECT * INTO v_state FROM sicas_circuit_breaker LIMIT 1;

  IF v_state IS NULL THEN
    INSERT INTO sicas_circuit_breaker (is_open, error_count_5min, timeout_count_5min)
    VALUES (false, 0, 0)
    RETURNING * INTO v_state;
  END IF;

  -- Get thresholds from config
  v_error_threshold := COALESCE((SELECT config_value::integer FROM sicas_rate_config WHERE config_key = 'CIRCUIT_BREAKER_ERROR_THRESHOLD'), 5);
  v_timeout_threshold := COALESCE((SELECT config_value::integer FROM sicas_rate_config WHERE config_key = 'CIRCUIT_BREAKER_TIMEOUT_THRESHOLD'), 3);
  v_pause_minutes := COALESCE((SELECT config_value::integer FROM sicas_rate_config WHERE config_key = 'CIRCUIT_BREAKER_PAUSE_MINUTES'), 15);

  -- Update counters
  IF p_is_timeout THEN
    UPDATE sicas_circuit_breaker
    SET timeout_count_5min = timeout_count_5min + 1,
        last_error_at = now(),
        updated_at = now()
    WHERE id = v_state.id;
  ELSE
    UPDATE sicas_circuit_breaker
    SET error_count_5min = error_count_5min + 1,
        last_error_at = now(),
        updated_at = now()
    WHERE id = v_state.id;
  END IF;

  -- Check if should trip
  SELECT * INTO v_state FROM sicas_circuit_breaker LIMIT 1;

  IF NOT v_state.is_open AND (
    v_state.error_count_5min >= v_error_threshold OR
    v_state.timeout_count_5min >= v_timeout_threshold
  ) THEN
    UPDATE sicas_circuit_breaker
    SET is_open = true,
        opened_at = now(),
        closes_at = now() + (v_pause_minutes || ' minutes')::interval,
        reason = CASE
          WHEN v_state.error_count_5min >= v_error_threshold THEN 'Demasiados errores 500 en 5 minutos'
          ELSE 'Demasiados timeouts en 5 minutos'
        END,
        updated_at = now()
    WHERE id = v_state.id;

    RETURN jsonb_build_object('tripped', true, 'closes_at', now() + (v_pause_minutes || ' minutes')::interval);
  END IF;

  RETURN jsonb_build_object('tripped', false);
END;
$$;

-- 11. Function to record a success (resets counters)
CREATE OR REPLACE FUNCTION record_sicas_success()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sicas_circuit_breaker
  SET error_count_5min = GREATEST(error_count_5min - 1, 0),
      timeout_count_5min = GREATEST(timeout_count_5min - 1, 0),
      last_success_at = now(),
      updated_at = now();
$$;

-- 12. Cleanup function for expired cache entries (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_sicas_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM sicas_request_cache WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 13. Admin function to force-release stuck locks
CREATE OR REPLACE FUNCTION admin_release_stuck_sicas_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer;
BEGIN
  UPDATE sicas_process_locks
  SET is_active = false
  WHERE is_active = true
    AND expires_at < now();
  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

-- 14. Admin function to manually reset circuit breaker
CREATE OR REPLACE FUNCTION admin_reset_circuit_breaker()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sicas_circuit_breaker
  SET is_open = false,
      error_count_5min = 0,
      timeout_count_5min = 0,
      reason = NULL,
      opened_at = NULL,
      closes_at = NULL,
      updated_at = now();
$$;
