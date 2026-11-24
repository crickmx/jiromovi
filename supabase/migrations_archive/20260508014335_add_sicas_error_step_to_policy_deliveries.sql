/*
  # Add SICAS error step tracking to policy_deliveries

  1. Modified Tables
    - `policy_deliveries`
      - `sicas_error_step` (text) - The exact step where SICAS returned an error
      - `sicas_request_debug` (jsonb) - Debug info about the request that failed

  2. Notes
    - These columns help diagnose exactly WHERE in the SICAS registration flow an error occurs
    - Steps: authenticate_sicas, resolve_required_fields, search_client, create_client_if_needed, build_hwcapture_payload, save_hwcapture, upload_digital_center, completed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_error_step'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_error_step text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_request_debug'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_request_debug jsonb;
  END IF;
END $$;
