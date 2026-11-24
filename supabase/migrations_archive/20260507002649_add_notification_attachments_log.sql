/*
  # Add notification attachments log and extend history

  1. New Tables
    - `notification_attachments_log`
      - `id` (uuid, primary key)
      - `notification_history_id` (uuid, FK to transactional_notification_history)
      - `ticket_id` (uuid)
      - `file_name` (text)
      - `file_path` (text)
      - `file_url` (text)
      - `mime_type` (text)
      - `file_size` (bigint)
      - `source` (text) - 'ticket', 'comment', 'policy_delivery', 'contact_center'
      - `channel` (text) - 'email', 'whatsapp'
      - `sent_successfully` (boolean)
      - `error_message` (text)
      - `created_at` (timestamptz)

  2. Modified Tables
    - `transactional_notification_history`
      - Add `ticket_id` (uuid) for linking to ticket
      - Add `ticket_folio` (text) for quick reference
      - Add `email_subject_rendered` (text) for actual sent subject
      - Add `attachments_count` (integer)
      - Add `attachments_sent_count` (integer)
      - Add `whatsapp_documents_sent_count` (integer)
      - Add `failed_attachments_count` (integer)
      - Add `recipient_email` (text)
      - Add `recipient_phone` (text)

  3. Security
    - Enable RLS on notification_attachments_log
    - Only authenticated users with admin/gerente/ejecutivo/empleado roles can read

  4. Notes
    - Safe migration: uses IF NOT EXISTS for all additions
    - Does not drop or modify existing data
*/

-- Add columns to transactional_notification_history
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'ticket_id') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN ticket_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'ticket_folio') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN ticket_folio text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'email_subject_rendered') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN email_subject_rendered text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'attachments_count') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN attachments_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'attachments_sent_count') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN attachments_sent_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'whatsapp_documents_sent_count') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN whatsapp_documents_sent_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'failed_attachments_count') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN failed_attachments_count integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'recipient_email') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN recipient_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactional_notification_history' AND column_name = 'recipient_phone') THEN
    ALTER TABLE transactional_notification_history ADD COLUMN recipient_phone text;
  END IF;
END $$;

-- Create notification_attachments_log table
CREATE TABLE IF NOT EXISTS notification_attachments_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_history_id uuid REFERENCES transactional_notification_history(id),
  ticket_id uuid,
  file_name text NOT NULL,
  file_path text,
  file_url text,
  mime_type text,
  file_size bigint DEFAULT 0,
  source text NOT NULL DEFAULT 'ticket',
  channel text NOT NULL DEFAULT 'email',
  sent_successfully boolean DEFAULT false,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notification_attachments_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and staff can read attachment logs"
  ON notification_attachments_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente', 'Ejecutivo', 'Empleado')
    )
  );

CREATE POLICY "System can insert attachment logs"
  ON notification_attachments_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente', 'Ejecutivo', 'Empleado')
    )
  );

-- Add index for ticket_id lookups
CREATE INDEX IF NOT EXISTS idx_notification_attachments_log_ticket_id
  ON notification_attachments_log(ticket_id);

CREATE INDEX IF NOT EXISTS idx_notification_attachments_log_history_id
  ON notification_attachments_log(notification_history_id);

-- Add index on transactional_notification_history for ticket lookups
CREATE INDEX IF NOT EXISTS idx_transactional_notification_history_ticket_id
  ON transactional_notification_history(ticket_id);
