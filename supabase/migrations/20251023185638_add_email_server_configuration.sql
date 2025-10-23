/*
  # Add Email Server Configuration

  1. New Table
    - `configuracion_servidor_correo` (Email Server Configuration)
      - `id` (uuid, primary key)
      - `tipo_servidor` (text) - smtp, imap, pop3
      - `host` (text) - Server host
      - `puerto` (integer) - Server port
      - `usuario` (text) - Email username
      - `password_encriptado` (text) - Encrypted password
      - `usa_ssl` (boolean) - Use SSL
      - `usa_tls` (boolean) - Use TLS
      - `email_remitente` (text) - From email address
      - `nombre_remitente` (text) - From name
      - `activo` (boolean) - Whether this config is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Only admins and gerentes can view and manage server configuration

  3. Notes
    - Only one SMTP configuration can be active at a time
    - Password should be encrypted before storage
*/

-- Create configuracion_servidor_correo table
CREATE TABLE IF NOT EXISTS configuracion_servidor_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_servidor text NOT NULL CHECK (tipo_servidor IN ('smtp', 'imap', 'pop3')),
  host text NOT NULL,
  puerto integer NOT NULL,
  usuario text NOT NULL,
  password_encriptado text NOT NULL,
  usa_ssl boolean DEFAULT false,
  usa_tls boolean DEFAULT true,
  email_remitente text NOT NULL,
  nombre_remitente text NOT NULL,
  activo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for active configurations
CREATE INDEX IF NOT EXISTS idx_servidor_correo_activo ON configuracion_servidor_correo(tipo_servidor, activo);

-- Enable RLS
ALTER TABLE configuracion_servidor_correo ENABLE ROW LEVEL SECURITY;

-- Policies for configuracion_servidor_correo
CREATE POLICY "Admins and Gerentes can view email server config"
  ON configuracion_servidor_correo FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can insert email server config"
  ON configuracion_servidor_correo FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can update email server config"
  ON configuracion_servidor_correo FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and Gerentes can delete email server config"
  ON configuracion_servidor_correo FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );
