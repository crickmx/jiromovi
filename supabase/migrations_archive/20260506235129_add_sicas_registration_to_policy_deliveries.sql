/*
  # Add SICAS Registration Fields to Policy Deliveries

  1. Modified Tables
    - `policy_deliveries` - Added 14 new columns for SICAS registration tracking

  2. New Tables
    - `sicas_registration_logs` - Audit log for all SICAS registration attempts

  3. Security
    - RLS enabled on sicas_registration_logs
    - Non-agent authenticated users can read logs
    - Authenticated users can insert their own log entries

  4. Notes
    - Existing data is backfilled with appropriate initial status
*/

-- Add SICAS registration columns to policy_deliveries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_registration_status'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_registration_status text DEFAULT 'not_started';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_document_id'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_document_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_registration_attempts'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_registration_attempts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_last_attempt_at'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_last_attempt_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_registered_at'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_registered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_request_payload'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_request_payload jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_response_raw'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_response_raw jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_error_message'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_error_message text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_duplicate_detected'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_duplicate_detected boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_duplicate_document_id'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_duplicate_document_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_duplicate_message'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_duplicate_message text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_files_upload_status'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_files_upload_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_files_response_raw'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_files_response_raw jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_manual_review_reason'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_manual_review_reason text;
  END IF;
END $$;

-- Add check constraint for valid SICAS registration statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'policy_deliveries_sicas_status_check'
  ) THEN
    ALTER TABLE policy_deliveries ADD CONSTRAINT policy_deliveries_sicas_status_check
      CHECK (sicas_registration_status IN (
        'not_started', 'ready_to_register', 'validating', 'duplicate_found',
        'registering', 'registered', 'uploading_files', 'completed',
        'error', 'manual_review_required'
      ));
  END IF;
END $$;

-- Add index for SICAS status filtering
CREATE INDEX IF NOT EXISTS idx_policy_deliveries_sicas_status
  ON policy_deliveries (sicas_registration_status);

-- Create SICAS registration logs table
CREATE TABLE IF NOT EXISTS sicas_registration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_delivery_id uuid NOT NULL REFERENCES policy_deliveries(id) ON DELETE CASCADE,
  ticket_id uuid,
  user_id uuid NOT NULL,
  action text NOT NULL,
  status text,
  request_payload jsonb,
  response_raw jsonb,
  error_message text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_registration_logs ENABLE ROW LEVEL SECURITY;

-- Index for querying logs by delivery
CREATE INDEX IF NOT EXISTS idx_sicas_reg_logs_delivery
  ON sicas_registration_logs (policy_delivery_id, created_at DESC);

-- RLS: Authenticated non-agent users can view logs
CREATE POLICY "Non-agents can view sicas registration logs"
  ON sicas_registration_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente', 'Empleado')
    )
  );

-- RLS: Authenticated users can insert log entries
CREATE POLICY "Authenticated users can insert sicas registration logs"
  ON sicas_registration_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Backfill existing deliveries with initial SICAS status
UPDATE policy_deliveries
SET sicas_registration_status = CASE
  WHEN policy_number IS NOT NULL
    AND insured_name IS NOT NULL
    AND start_date IS NOT NULL
    AND end_date IS NOT NULL
    AND vendor_sicas_id IS NOT NULL
    AND cover_file_path IS NOT NULL
    AND ticket_id IS NOT NULL
  THEN 'ready_to_register'
  ELSE 'manual_review_required'
END
WHERE sicas_registration_status = 'not_started'
  OR sicas_registration_status IS NULL;

-- Set manual_review_reason for entries that need review
UPDATE policy_deliveries
SET sicas_manual_review_reason = array_to_string(ARRAY[]::text[]
  || CASE WHEN policy_number IS NULL THEN ARRAY['Numero de poliza'] ELSE ARRAY[]::text[] END
  || CASE WHEN insured_name IS NULL THEN ARRAY['Nombre del asegurado'] ELSE ARRAY[]::text[] END
  || CASE WHEN start_date IS NULL THEN ARRAY['Inicio de vigencia'] ELSE ARRAY[]::text[] END
  || CASE WHEN end_date IS NULL THEN ARRAY['Fin de vigencia'] ELSE ARRAY[]::text[] END
  || CASE WHEN vendor_sicas_id IS NULL THEN ARRAY['Vendedor SICAS'] ELSE ARRAY[]::text[] END
  || CASE WHEN cover_file_path IS NULL THEN ARRAY['Caratula PDF'] ELSE ARRAY[]::text[] END
  || CASE WHEN ticket_id IS NULL THEN ARRAY['Tramite MOVI'] ELSE ARRAY[]::text[] END
, ', ')
WHERE sicas_registration_status = 'manual_review_required';
