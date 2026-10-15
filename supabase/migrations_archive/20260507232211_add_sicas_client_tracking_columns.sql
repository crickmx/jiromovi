/*
  # Add SICAS Client Tracking Columns to policy_deliveries

  1. New Columns
    - `sicas_client_id` (text) - The IDCli assigned from SICAS
    - `sicas_client_name` (text) - The name of the matched/created client
    - `sicas_client_auto_created` (boolean) - Whether client was auto-created
    - `sicas_client_created_at` (timestamptz) - When auto-creation happened
    - `sicas_client_create_response_raw` (jsonb) - Raw SICAS response from creation
    - `sicas_client_match_method` (text) - How client was matched (rfc_exact, name_exact, auto_created)
    - `sicas_client_match_confidence` (text) - Confidence level (high, medium, low)

  2. Notes
    - These columns track the automatic client resolution/creation process
    - sicas_client_auto_created helps audit which clients were auto-created vs found
    - The match_method field documents the resolution path for debugging
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_client_id'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_client_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_client_name'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_client_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_client_auto_created'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_client_auto_created boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_client_created_at'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_client_created_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_client_create_response_raw'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_client_create_response_raw jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_client_match_method'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_client_match_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_client_match_confidence'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_client_match_confidence text;
  END IF;
END $$;
