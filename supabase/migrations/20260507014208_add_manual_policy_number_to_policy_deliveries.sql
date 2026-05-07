/*
  # Add manual policy number field to policy_deliveries

  1. Modified Tables
    - `policy_deliveries`
      - `manual_policy_number` (text, nullable) - Manually entered policy number that takes priority over extracted data
      - `manual_policy_number_set_by` (uuid, nullable) - User who set the manual policy number
      - `manual_policy_number_set_at` (timestamptz, nullable) - When the manual policy number was set
      - `manual_policy_number_previous` (text, nullable) - Previous value before manual override (audit)

  2. Important Notes
    - This field takes priority over lector Qualitas extracted data for SICAS registration
    - Allows admin/gerente to correct the policy number before retrying SICAS registration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'manual_policy_number'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN manual_policy_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'manual_policy_number_set_by'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN manual_policy_number_set_by uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'manual_policy_number_set_at'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN manual_policy_number_set_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'manual_policy_number_previous'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN manual_policy_number_previous text;
  END IF;
END $$;
