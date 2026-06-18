/*
  # Auto-Tramite Creation from Centro de Contacto Agent

  ## Summary
  Adds support for the automatic agent to create real tramites after user confirmation.

  ## New Columns
  ### contact_center_assistant_sessions
  - `idempotency_key` (text, unique) — prevents duplicate tramite creation per session+form
  - `tramite_created_at` (timestamptz) — when the tramite was created
  - `tramite_creation_error` (text) — error message if creation failed
  - `handoff_sent` (boolean) — whether the handoff notification was sent

  ### contact_center_assistants
  - `tramite_assigned_to_user_id` (uuid) — default employee to assign tramites to
  - `tramite_estatus_slug` (text) — initial status slug for created tramites

  ## Notes
  - idempotency_key = session_id + ':' + form_slug ensures exactly one tramite per session
  - tramite_creation_error allows UI to show error state without losing the session
  - handoff_sent flag prevents duplicate handoff notifications
*/

-- Add new columns to sessions table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_sessions' AND column_name = 'idempotency_key') THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN idempotency_key text UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_sessions' AND column_name = 'tramite_created_at') THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN tramite_created_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_sessions' AND column_name = 'tramite_creation_error') THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN tramite_creation_error text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistant_sessions' AND column_name = 'handoff_sent') THEN
    ALTER TABLE contact_center_assistant_sessions ADD COLUMN handoff_sent boolean DEFAULT false;
  END IF;
END $$;

-- Add default assignee and status columns to assistants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'tramite_assigned_to_user_id') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN tramite_assigned_to_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_center_assistants' AND column_name = 'tramite_estatus_slug') THEN
    ALTER TABLE contact_center_assistants ADD COLUMN tramite_estatus_slug text DEFAULT 'Iniciado';
  END IF;
END $$;

-- Index for fast idempotency lookups
CREATE INDEX IF NOT EXISTS idx_cc_sessions_idempotency_key
  ON contact_center_assistant_sessions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
