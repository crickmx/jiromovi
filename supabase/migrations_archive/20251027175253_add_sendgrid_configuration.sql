/*
  # Add SendGrid Configuration

  1. Changes
    - Create `configuracion_sendgrid` table for SendGrid API settings
    - Store API key, sender email, and sender name
    - Enable RLS with policies for administrators and managers

  2. Security
    - Enable RLS on table
    - Only administrators can manage SendGrid configuration
    - Managers can view configuration
*/

-- Create SendGrid configuration table
CREATE TABLE IF NOT EXISTS configuracion_sendgrid (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL,
  email_remitente text NOT NULL,
  nombre_remitente text NOT NULL,
  activo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE configuracion_sendgrid ENABLE ROW LEVEL SECURITY;

-- Policies for SendGrid configuration
CREATE POLICY "Administrators can manage SendGrid configuration"
  ON configuracion_sendgrid
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Managers can view SendGrid configuration"
  ON configuracion_sendgrid
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );
