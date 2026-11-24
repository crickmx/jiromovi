/*
  # Create Audit Logs Table

  1. New Tables
    - `audit_logs`
      - `id` (uuid, primary key)
      - `action` (text) - Tipo de acción: USER_DELETE, USER_CREATE, USER_UPDATE, etc.
      - `performed_by` (uuid) - ID del usuario que realizó la acción
      - `target_user_id` (uuid nullable) - ID del usuario afectado (si aplica)
      - `target_resource_type` (text nullable) - Tipo de recurso afectado
      - `target_resource_id` (uuid nullable) - ID del recurso afectado
      - `details` (jsonb) - Detalles adicionales de la acción
      - `ip_address` (text nullable) - IP desde donde se realizó la acción
      - `user_agent` (text nullable) - User agent del navegador
      - `created_at` (timestamptz) - Fecha/hora de la acción
      
  2. Security
    - Enable RLS
    - Only admins can read audit logs
    - System can insert audit logs
    
  3. Indexes
    - Index on performed_by for quick lookups
    - Index on target_user_id for user-specific audits
    - Index on action for filtering by action type
    - Index on created_at for time-based queries
*/

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  performed_by uuid NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  target_resource_type text,
  target_resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by 
  ON audit_logs(performed_by);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id 
  ON audit_logs(target_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
  ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
  ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
  ON audit_logs(target_resource_type, target_resource_id);

-- RLS Policies

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.is_deleted = false
    )
  );

-- System can insert audit logs (via service_role or functions)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE audit_logs IS 'Registro de auditoría de acciones administrativas';
COMMENT ON COLUMN audit_logs.action IS 'Tipo de acción realizada (USER_DELETE, USER_CREATE, etc.)';
COMMENT ON COLUMN audit_logs.performed_by IS 'Usuario que realizó la acción';
COMMENT ON COLUMN audit_logs.target_user_id IS 'Usuario afectado por la acción';
COMMENT ON COLUMN audit_logs.details IS 'Detalles adicionales en formato JSON';
