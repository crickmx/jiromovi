/*
  # Configure LOCAL_FIRST_SAFE_MODE for SICAS

  1. Modified Tables
    - `sicas_config`
      - Added `local_first_mode` (boolean, default true) - When true, platform uses local data primarily
      - Added `auto_sync_enabled` (boolean, default false) - Controls automatic SOAP sync
      - Added `last_successful_local_count` (integer, default 0) - Count from last successful sync
      - Added `last_successful_historic_report` (text) - Name of report that last produced real data
      - Added `excluded_report_codes` (text[], default HAPPDATAL_D004) - Reports excluded from document sync
      - Added `soap_diagnostic_enabled` (boolean, default true) - Whether lightweight diagnostic is allowed

  2. Important Notes
    - REST is disabled via existing use_rest=false flag
    - The best historical sync was HWS_DOCTOS_REST with 163,912 docs
    - REST currently returns 404, so mode is LOCAL_FIRST
    - SOAP diagnostic remains enabled for lightweight testing
    - Full SOAP sync requires a validated KeyCode
    - HAPPDATAL_D004 is excluded (cobranza, not documents)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_config' AND column_name = 'local_first_mode'
  ) THEN
    ALTER TABLE sicas_config ADD COLUMN local_first_mode boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_config' AND column_name = 'auto_sync_enabled'
  ) THEN
    ALTER TABLE sicas_config ADD COLUMN auto_sync_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_config' AND column_name = 'last_successful_local_count'
  ) THEN
    ALTER TABLE sicas_config ADD COLUMN last_successful_local_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_config' AND column_name = 'last_successful_historic_report'
  ) THEN
    ALTER TABLE sicas_config ADD COLUMN last_successful_historic_report text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_config' AND column_name = 'excluded_report_codes'
  ) THEN
    ALTER TABLE sicas_config ADD COLUMN excluded_report_codes text[] DEFAULT ARRAY['HAPPDATAL_D004'];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_config' AND column_name = 'soap_diagnostic_enabled'
  ) THEN
    ALTER TABLE sicas_config ADD COLUMN soap_diagnostic_enabled boolean DEFAULT true;
  END IF;
END $$;

-- Set safe defaults for existing config rows
UPDATE sicas_config SET
  local_first_mode = true,
  auto_sync_enabled = false,
  soap_diagnostic_enabled = true,
  last_successful_historic_report = COALESCE(last_successful_historic_report, 'HWS_DOCTOS_REST'),
  last_successful_local_count = COALESCE(last_successful_local_count, 163912),
  excluded_report_codes = COALESCE(excluded_report_codes, ARRAY['HAPPDATAL_D004'])
WHERE local_first_mode IS NULL OR auto_sync_enabled IS NULL;
