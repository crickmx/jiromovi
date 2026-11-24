/*
  # Add use_rest flag to sicas_config

  1. Modified Tables
    - `sicas_config`
      - Added `use_rest` (boolean, default false) - Controls whether REST API should be used for SICAS sync
      - When false (default), all sync operations use SOAP exclusively
      - When true, sync will attempt REST API first

  2. Important Notes
    - REST endpoint (security-services.sicasonline.info) returns 404 for current license
    - SOAP endpoint (www.sicasonline.com.mx) is the confirmed working method
    - This flag allows re-enabling REST in the future when/if SICAS confirms availability
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_config' AND column_name = 'use_rest'
  ) THEN
    ALTER TABLE sicas_config ADD COLUMN use_rest boolean DEFAULT false;
  END IF;
END $$;

-- Ensure all existing configs have use_rest = false
UPDATE sicas_config SET use_rest = false WHERE use_rest IS NULL;
