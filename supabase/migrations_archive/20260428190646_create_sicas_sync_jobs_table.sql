/*
  # Create SICAS sync jobs table for background processing

  1. New Tables
    - `sicas_sync_jobs`
      - `id` (uuid, primary key) - Job identifier
      - `mode` (text) - 'full' or 'incremental'
      - `status` (text) - 'queued', 'running', 'completed', 'failed', 'cancelled'
      - `triggered_by` (uuid, FK to usuarios) - User who started the sync
      - `total_in_sicas` (integer) - Total documents reported by SICAS API
      - `total_pages` (integer) - Total pages to process
      - `current_page` (integer) - Last page processed
      - `total_synced` (integer) - Accumulated documents upserted
      - `total_errors` (integer) - Accumulated errors
      - `percent` (integer) - Progress percentage 0-100
      - `error_message` (text) - Error details if failed
      - `started_at` (timestamptz) - When the job started
      - `updated_at` (timestamptz) - Last progress update
      - `finished_at` (timestamptz) - When the job completed
      - `keycode` (text) - SICAS report keycode used

  2. Security
    - Enable RLS on `sicas_sync_jobs` table
    - Admin and gerente roles can read and manage sync jobs

  3. Notes
    - This table enables the sync to continue in the background even if the user closes the browser
    - The orchestrator edge function reads/writes this table to track progress
    - Frontend polls this table to show progress
*/

CREATE TABLE IF NOT EXISTS sicas_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'full' CHECK (mode IN ('full', 'incremental')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  triggered_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  total_in_sicas integer DEFAULT 0,
  total_pages integer DEFAULT 0,
  current_page integer DEFAULT 0,
  total_synced integer DEFAULT 0,
  total_errors integer DEFAULT 0,
  percent integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  keycode text DEFAULT 'HWS_DOCTOS',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage sync jobs"
  ON sicas_sync_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'superadmin')
    )
  );

-- Gerentes can view sync jobs
CREATE POLICY "Gerentes can view sync jobs"
  ON sicas_sync_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'gerente'
    )
  );

-- Index for quick status lookups
CREATE INDEX IF NOT EXISTS idx_sicas_sync_jobs_status ON sicas_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sicas_sync_jobs_created_at ON sicas_sync_jobs(created_at DESC);
