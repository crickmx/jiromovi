/*
  # Create SICAS Production Insights Cache

  1. New Tables
    - `sicas_production_insights_cache`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, unique, references usuarios)
      - `alerts` (jsonb) - cached alert data
      - `opportunities` (jsonb) - cached opportunity data
      - `ai_summary` (text) - optional AI-generated summary
      - `diagnostics` (jsonb) - metadata about the generation
      - `updated_at` (timestamptz) - cache timestamp for TTL

  2. Security
    - Enable RLS on table
    - Users can only read/write their own cache entry
    - Service role has full access (for edge function)

  3. Notes
    - Cache TTL is 30 minutes (enforced by edge function)
    - One row per user (upsert on usuario_id)
*/

CREATE TABLE IF NOT EXISTS sicas_production_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE,
  alerts jsonb DEFAULT '[]'::jsonb,
  opportunities jsonb DEFAULT '[]'::jsonb,
  ai_summary text,
  diagnostics jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_production_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own insights cache"
  ON sicas_production_insights_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own insights cache"
  ON sicas_production_insights_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update own insights cache"
  ON sicas_production_insights_cache
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Service role full access insights cache"
  ON sicas_production_insights_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sicas_insights_cache_usuario
  ON sicas_production_insights_cache(usuario_id);

CREATE INDEX IF NOT EXISTS idx_sicas_insights_cache_updated
  ON sicas_production_insights_cache(updated_at);
