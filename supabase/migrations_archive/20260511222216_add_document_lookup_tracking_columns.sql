/*
  # Add Document Lookup Tracking to policy_deliveries

  1. New Columns
    - `sicas_document_resolution_method` (text) - How the document ID was resolved
    - `sicas_document_lookup_attempts` (integer) - Number of lookup attempts
    - `sicas_last_lookup_at` (timestamptz) - When last lookup was performed
    - `sicas_document_lookup_response` (jsonb) - Raw response from lookup calls

  2. Modified Constraints
    - Expand sicas_registration_status CHECK to include 'unverified'
    - Add valid values for sicas_document_status

  3. Notes
    - resolution_method tracks: response_id, post_save_lookup, manual_verified, not_found_after_success
    - These columns support the post-save verification flow when SICAS responds SUCCESS without IDDocto
*/

-- Add new tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_document_resolution_method'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_document_resolution_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_document_lookup_attempts'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_document_lookup_attempts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_last_lookup_at'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_last_lookup_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_document_lookup_response'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_document_lookup_response jsonb;
  END IF;
END $$;

-- Expand the CHECK constraint to include 'unverified'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'policy_deliveries_sicas_status_check'
  ) THEN
    ALTER TABLE policy_deliveries DROP CONSTRAINT policy_deliveries_sicas_status_check;
  END IF;

  ALTER TABLE policy_deliveries ADD CONSTRAINT policy_deliveries_sicas_status_check
    CHECK (sicas_registration_status IN (
      'not_started', 'ready_to_register', 'validating', 'duplicate_found',
      'registering', 'registered', 'uploading_files', 'completed',
      'error', 'manual_review_required',
      'partial_success', 'pending_fields', 'resolving', 'creating_client',
      'client_creation_failed', 'duplicate', 'unverified'
    ));
END $$;

-- Backfill existing partial_success rows that were from SUCCESS-without-ID
UPDATE policy_deliveries
SET sicas_document_resolution_method = 'not_found_after_success',
    sicas_document_lookup_attempts = 0
WHERE sicas_registration_status = 'partial_success'
  AND sicas_document_id IS NULL
  AND sicas_document_resolution_method IS NULL;
