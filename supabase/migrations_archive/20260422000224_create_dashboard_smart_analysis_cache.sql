/*
  # Create Dashboard Smart Analysis Cache

  1. New Tables
    - `dashboard_smart_analysis`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `analysis_json` (jsonb, the structured analysis from ChatGPT)
      - `sicas_context_hash` (text, hash of input SICAS data to detect changes)
      - `periodo` (text, e.g. "2026-04")
      - `has_sicas_mapping` (boolean, whether user has SICAS mapping)
      - `source` (text, 'chatgpt' or 'fallback')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `dashboard_smart_analysis` table
    - Users can only read/write their own analysis cache

  3. Notes
    - One cached analysis per user (upsert on user_id)
    - Regenerate when: new SICAS sync, period change, manual refresh, or context hash changes
*/

CREATE TABLE IF NOT EXISTS dashboard_smart_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sicas_context_hash text NOT NULL DEFAULT '',
  periodo text NOT NULL DEFAULT '',
  has_sicas_mapping boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'fallback',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_smart_analysis_user_unique UNIQUE (user_id)
);

ALTER TABLE dashboard_smart_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own analysis"
  ON dashboard_smart_analysis FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis"
  ON dashboard_smart_analysis FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis"
  ON dashboard_smart_analysis FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_smart_analysis_user_id
  ON dashboard_smart_analysis(user_id);
