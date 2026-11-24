/*
  # Create Admin Impersonation Sessions

  1. New Tables
    - `admin_impersonation_sessions`
      - `id` (uuid, primary key)
      - `admin_user_id` (uuid, FK to usuarios) - The admin performing impersonation
      - `impersonated_user_id` (uuid, nullable) - MOVI user being impersonated (FK to usuarios)
      - `impersonated_customer_id` (uuid, nullable) - Seguwallet customer being impersonated
      - `platform` (text) - 'movi' or 'seguwallet'
      - `started_at` (timestamptz) - When impersonation began
      - `ended_at` (timestamptz, nullable) - When impersonation ended
      - `status` (text) - 'active', 'ended'
      - `reason` (text, nullable) - Optional reason for impersonation
      - `user_agent` (text, nullable) - Browser user agent
      - `ip_address` (text, nullable) - IP address if available
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Only Administrador role can insert/read/update
    - Policies check auth.uid() matches admin_user_id

  3. Important Notes
    - This table is audit-only; it does NOT grant any access
    - The impersonation logic is frontend-only (context switching)
    - No actual session tokens or auth changes occur
*/

-- Create the impersonation sessions table
CREATE TABLE IF NOT EXISTS admin_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES usuarios(id),
  impersonated_user_id uuid REFERENCES usuarios(id),
  impersonated_customer_id uuid,
  platform text NOT NULL DEFAULT 'movi' CHECK (platform IN ('movi', 'seguwallet')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  reason text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_impersonation_admin_user ON admin_impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_status ON admin_impersonation_sessions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_impersonation_started_at ON admin_impersonation_sessions(started_at DESC);

-- Enable RLS
ALTER TABLE admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins can view their own impersonation sessions
CREATE POLICY "Admins can view own impersonation sessions"
  ON admin_impersonation_sessions
  FOR SELECT
  TO authenticated
  USING (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
      AND deleted_at IS NULL
    )
  );

-- Only admins can create impersonation sessions
CREATE POLICY "Admins can create impersonation sessions"
  ON admin_impersonation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
      AND deleted_at IS NULL
    )
  );

-- Only admins can end their own sessions
CREATE POLICY "Admins can end own impersonation sessions"
  ON admin_impersonation_sessions
  FOR UPDATE
  TO authenticated
  USING (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
      AND deleted_at IS NULL
    )
  );
