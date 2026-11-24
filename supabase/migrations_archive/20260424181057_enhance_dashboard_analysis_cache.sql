/*
  # Enhance Dashboard Smart Analysis Cache

  1. Modified Tables
    - `dashboard_smart_analysis`
      - Add `context_json` (jsonb) - stores the full module context sent to ChatGPT for debugging
      - Add `model_used` (text) - which OpenAI model generated the message
      - Add `generation_ms` (integer) - time taken to generate the message in milliseconds
      - Add `modules_included` (text[]) - list of module names that had data
      - Add `expires_at` (timestamptz) - explicit expiration timestamp for the cache entry

  2. Notes
    - context_json allows debugging what data was sent to ChatGPT
    - modules_included enables quick filtering of which modules contributed
    - expires_at replaces the 4-hour TTL hardcoded in the frontend
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_smart_analysis' AND column_name = 'context_json'
  ) THEN
    ALTER TABLE dashboard_smart_analysis ADD COLUMN context_json jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_smart_analysis' AND column_name = 'model_used'
  ) THEN
    ALTER TABLE dashboard_smart_analysis ADD COLUMN model_used text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_smart_analysis' AND column_name = 'generation_ms'
  ) THEN
    ALTER TABLE dashboard_smart_analysis ADD COLUMN generation_ms integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_smart_analysis' AND column_name = 'modules_included'
  ) THEN
    ALTER TABLE dashboard_smart_analysis ADD COLUMN modules_included text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dashboard_smart_analysis' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE dashboard_smart_analysis ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '6 hours');
  END IF;
END $$;
