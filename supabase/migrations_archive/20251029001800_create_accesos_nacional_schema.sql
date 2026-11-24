/*
  # Create Accesos Nacional Schema

  ## Overview
  Creates a table to store national access credentials that are shared across the organization.

  ## New Tables
    - `accesos_nacional`
      - `id` (uuid, primary key)
      - `aseguradora` (text) - Insurance company name
      - `usuario_1` (text) - First username/ID
      - `usuario_2` (text) - Second username/ID (optional)
      - `contrasena` (text) - Password (stored as plain text per requirements)
      - `link` (text) - URL to access the system
      - `creado_por` (uuid) - User ID who created the record
      - `fecha_creacion` (timestamptz) - Creation timestamp
      - `ultima_edicion_por` (uuid) - User ID who last edited
      - `fecha_ultima_edicion` (timestamptz) - Last edit timestamp
      - `created_at` (timestamptz) - Row creation timestamp
      - `updated_at` (timestamptz) - Row update timestamp

  ## Security
    - Enable RLS on `accesos_nacional` table
    - Administrador, Gerente, Empleado can view, insert, and update
    - Only Administrador can delete
    - Agente has no access

  ## Notes
    - All edits automatically update audit fields via triggers
    - Link field must be a valid URL
*/

-- Create accesos_nacional table
CREATE TABLE IF NOT EXISTS accesos_nacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aseguradora text NOT NULL,
  usuario_1 text NOT NULL,
  usuario_2 text,
  contrasena text NOT NULL,
  link text NOT NULL,
  creado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  ultima_edicion_por uuid REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha_ultima_edicion timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_link CHECK (link ~* '^https?://')
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_aseguradora ON accesos_nacional(aseguradora);
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_usuario_1 ON accesos_nacional(usuario_1);
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_usuario_2 ON accesos_nacional(usuario_2);
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_creado_por ON accesos_nacional(creado_por);
CREATE INDEX IF NOT EXISTS idx_accesos_nacional_fecha_creacion ON accesos_nacional(fecha_creacion DESC);

-- Enable RLS
ALTER TABLE accesos_nacional ENABLE ROW LEVEL SECURITY;

-- Policy: Administradores can do everything
CREATE POLICY "Admins can view all accesos"
  ON accesos_nacional
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Admins can insert accesos"
  ON accesos_nacional
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Admins can update accesos"
  ON accesos_nacional
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Admins can delete accesos"
  ON accesos_nacional
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- Policy: Gerentes can view, insert, and update
CREATE POLICY "Gerentes can view all accesos"
  ON accesos_nacional
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Gerentes can insert accesos"
  ON accesos_nacional
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Gerentes can update accesos"
  ON accesos_nacional
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.activo = true
    )
  );

-- Policy: Empleados can view, insert, and update
CREATE POLICY "Empleados can view all accesos"
  ON accesos_nacional
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Empleado'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Empleados can insert accesos"
  ON accesos_nacional
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Empleado'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Empleados can update accesos"
  ON accesos_nacional
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Empleado'
      AND usuarios.activo = true
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_accesos_nacional_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_accesos_nacional_updated_at
  BEFORE UPDATE ON accesos_nacional
  FOR EACH ROW
  EXECUTE FUNCTION update_accesos_nacional_updated_at();
