/*
  # SICAS Digital Center Cache and Logs

  ## New Tables
  - `sicas_digital_center_cache`: Short-lived cache (15 min TTL) for Centro Digital API responses
    - `entity_type`: document | contact | client | endorsement | claim | receipt etc.
    - `entity_id`: The SICAS ID used to query
    - `request_hash`: MD5-style key for deduplication
    - `response_json`: Normalized response from SICAS
    - `expires_at`: Cache expiry timestamp
  - `sicas_digital_center_logs`: Audit log for every Centro Digital query
    - Stores user, entity type/id, status, and error message
    - Never stores credentials or binary content

  ## Security
  - RLS enabled on both tables
  - Only service role or authenticated users with matching user_id can read logs
  - Cache is readable by any authenticated user (data is not sensitive metadata)
*/

-- Cache table
CREATE TABLE IF NOT EXISTS sicas_digital_center_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  office_id uuid,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT sicas_dc_cache_hash_key UNIQUE (request_hash)
);

CREATE INDEX IF NOT EXISTS idx_sicas_dc_cache_hash ON sicas_digital_center_cache (request_hash);
CREATE INDEX IF NOT EXISTS idx_sicas_dc_cache_expires ON sicas_digital_center_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_sicas_dc_cache_entity ON sicas_digital_center_cache (entity_type, entity_id);

ALTER TABLE sicas_digital_center_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cache"
  ON sicas_digital_center_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages cache"
  ON sicas_digital_center_cache FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role updates cache"
  ON sicas_digital_center_cache FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role deletes cache"
  ON sicas_digital_center_cache FOR DELETE
  TO service_role
  USING (true);

-- Logs table
CREATE TABLE IF NOT EXISTS sicas_digital_center_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  tenant_id uuid,
  office_id uuid,
  entity_type text,
  entity_id text,
  status text NOT NULL DEFAULT 'pending',
  source text DEFAULT 'sicas',
  error_message text,
  response_time_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sicas_dc_logs_user ON sicas_digital_center_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_sicas_dc_logs_entity ON sicas_digital_center_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sicas_dc_logs_created ON sicas_digital_center_logs (created_at DESC);

ALTER TABLE sicas_digital_center_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs"
  ON sicas_digital_center_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages logs"
  ON sicas_digital_center_logs FOR INSERT
  TO service_role
  WITH CHECK (true);
