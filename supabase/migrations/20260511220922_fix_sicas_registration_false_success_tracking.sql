/*
  # Fix SICAS Registration False Success - Add Stage Tracking

  1. Modified Tables
    - `policy_deliveries`
      - `sicas_contact_status` (text) - Status of contact/client step: created, existing, failed, not_attempted
      - `sicas_document_status` (text) - Status of document/policy step: created, existing, failed, not_attempted
      - `sicas_contact_response` (jsonb) - Raw SICAS response from contact creation step
      - `sicas_document_response` (jsonb) - Raw SICAS response from document registration step
      - `sicas_registration_stage` (text) - Last completed stage in the flow
      - `sicas_resolved_fields` (jsonb) - Resolved field values from auto-resolution
      - `sicas_resolution_warnings` (text[]) - Warnings from auto-resolution

  2. Changed Constraints
    - Expanded sicas_registration_status CHECK to include new states:
      - 'partial_success' (contact created but document failed)
      - 'pending_fields' (awaiting field resolution)
      - 'resolving' (currently resolving fields)
      - 'creating_client' (currently creating client)
      - 'client_creation_failed' (client creation specifically failed)
      - 'duplicate' (alias for duplicate_found)

  3. Notes
    - The key fix: "registered" status now ONLY set when sicas_document_id is populated
    - "partial_success" means contact was created but document registration failed
    - Users can retry just the document step without re-creating the contact
*/

-- Add new stage-tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_contact_status'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_contact_status text DEFAULT 'not_attempted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_document_status'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_document_status text DEFAULT 'not_attempted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_contact_response'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_contact_response jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_document_response'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_document_response jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_registration_stage'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_registration_stage text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_resolved_fields'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_resolved_fields jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policy_deliveries' AND column_name = 'sicas_resolution_warnings'
  ) THEN
    ALTER TABLE policy_deliveries ADD COLUMN sicas_resolution_warnings text[];
  END IF;
END $$;

-- Drop the old constraint and create an expanded one
ALTER TABLE policy_deliveries DROP CONSTRAINT IF EXISTS policy_deliveries_sicas_status_check;

ALTER TABLE policy_deliveries ADD CONSTRAINT policy_deliveries_sicas_status_check
  CHECK (sicas_registration_status IN (
    'not_started', 'ready_to_register', 'pending_fields', 'validating',
    'resolving', 'creating_client', 'client_creation_failed',
    'duplicate_found', 'duplicate',
    'registering', 'registered', 'uploading_files', 'completed',
    'partial_success',
    'error', 'manual_review_required'
  ));

-- Backfill: any rows currently "registered" but without sicas_document_id should be partial_success
UPDATE policy_deliveries
SET sicas_registration_status = 'partial_success',
    sicas_contact_status = 'created',
    sicas_document_status = 'not_attempted'
WHERE sicas_registration_status = 'registered'
  AND (sicas_document_id IS NULL OR sicas_document_id = '');

-- Backfill: rows that ARE registered with a document_id get proper stage tracking
UPDATE policy_deliveries
SET sicas_contact_status = CASE
      WHEN sicas_client_id IS NOT NULL THEN 'created'
      ELSE 'existing'
    END,
    sicas_document_status = 'created',
    sicas_registration_stage = 'completed'
WHERE sicas_registration_status = 'registered'
  AND sicas_document_id IS NOT NULL
  AND sicas_document_id != '';
