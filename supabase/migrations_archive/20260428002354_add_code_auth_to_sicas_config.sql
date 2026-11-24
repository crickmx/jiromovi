/*
  # Add CodeAuth field to SICAS configuration

  1. Modified Tables
    - `sicas_config`
      - `code_auth` (text, nullable) - REST API CodeAuth token for advanced filtering

  2. Notes
    - CodeAuth is used by the SICAS REST API for authenticated report queries
    - Stored in the database so edge functions can read it without requiring env var secrets
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_config' AND column_name = 'code_auth'
  ) THEN
    ALTER TABLE sicas_config ADD COLUMN code_auth text;
  END IF;
END $$;
