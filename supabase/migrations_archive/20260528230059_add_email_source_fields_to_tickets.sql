/*
  # Add email source fields to tickets table

  1. Modified Tables
    - `tickets`
      - `canal_origen` (text) - Source channel: 'email', 'whatsapp', 'chat', 'manual'
      - `source_email_account` (text) - Email account that received the message
      - `source_email_folder` (text) - IMAP folder where the email resides
      - `source_email_uid` (integer) - IMAP UID of the source email
      - `source_email_message_id` (text) - RFC message-id header
      - `source_email_from_name` (text) - Sender display name
      - `source_email_from_email` (text) - Sender email address
      - `source_email_subject` (text) - Email subject line
      - `source_email_date` (timestamptz) - Date the email was sent
      - `ai_summary` (text) - AI-generated summary of the source content
      - `ai_extracted_data` (jsonb) - AI-extracted structured data
      - `user_edited_summary` (text) - User-edited version of the AI summary
      - `assignment_method` (text) - How the agent was assigned: 'automatic', 'manual', 'suggested'

  2. New Index
    - Index on (source_email_message_id) for duplicate detection

  3. Important Notes
    - Non-destructive: only adds nullable columns
    - No existing data is modified
    - Supports duplicate detection via source_email_message_id + source_email_account
*/

-- Add canal_origen column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'canal_origen'
  ) THEN
    ALTER TABLE tickets ADD COLUMN canal_origen text DEFAULT NULL;
  END IF;
END $$;

-- Add email source columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'source_email_account'
  ) THEN
    ALTER TABLE tickets ADD COLUMN source_email_account text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'source_email_folder'
  ) THEN
    ALTER TABLE tickets ADD COLUMN source_email_folder text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'source_email_uid'
  ) THEN
    ALTER TABLE tickets ADD COLUMN source_email_uid integer DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'source_email_message_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN source_email_message_id text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'source_email_from_name'
  ) THEN
    ALTER TABLE tickets ADD COLUMN source_email_from_name text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'source_email_from_email'
  ) THEN
    ALTER TABLE tickets ADD COLUMN source_email_from_email text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'source_email_subject'
  ) THEN
    ALTER TABLE tickets ADD COLUMN source_email_subject text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'source_email_date'
  ) THEN
    ALTER TABLE tickets ADD COLUMN source_email_date timestamptz DEFAULT NULL;
  END IF;
END $$;

-- AI fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE tickets ADD COLUMN ai_summary text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'ai_extracted_data'
  ) THEN
    ALTER TABLE tickets ADD COLUMN ai_extracted_data jsonb DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'user_edited_summary'
  ) THEN
    ALTER TABLE tickets ADD COLUMN user_edited_summary text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'assignment_method'
  ) THEN
    ALTER TABLE tickets ADD COLUMN assignment_method text DEFAULT NULL;
  END IF;
END $$;

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_tickets_source_email_message_id
  ON tickets (source_email_message_id)
  WHERE source_email_message_id IS NOT NULL;

-- Composite index for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_tickets_email_source_lookup
  ON tickets (source_email_account, source_email_uid, canal_origen)
  WHERE canal_origen = 'email';
