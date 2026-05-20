/*
  # Create Wazzup Webhook Log Table

  1. New Tables
    - `wazzup_webhook_logs` - captures every raw Wazzup webhook event for debugging
      - `id` (uuid, primary key)
      - `received_at` (timestamptz)
      - `method` (text)
      - `body_raw` (text) - raw body for debugging
      - `payload` (jsonb) - parsed payload
      - `messages_count` (int) - number of messages in payload
      - `statuses_count` (int) - number of statuses in payload
      - `processing_logs` (text[]) - processing log entries
      - `error` (text) - any error that occurred
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Admins can read all logs
    - Service role can insert (via edge function)

  3. Notes
    - Retention: logs auto-expire after 7 days (handled by cleanup cron)
    - This table is for diagnostics only
*/

CREATE TABLE IF NOT EXISTS wazzup_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  method text,
  body_raw text,
  payload jsonb,
  messages_count int DEFAULT 0,
  statuses_count int DEFAULT 0,
  processing_logs text[],
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wazzup_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read webhook logs"
  ON wazzup_webhook_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.activo = true
    )
  );

CREATE POLICY "Service role can insert webhook logs"
  ON wazzup_webhook_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wazzup_webhook_logs_received_at 
  ON wazzup_webhook_logs (received_at DESC);
