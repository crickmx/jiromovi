/*
  # Fix Accesos Nacional Schema
  
  1. Changes
    - Drop and recreate accesos_nacional table with correct schema
    - Add proper columns: aseguradora, usuario_1, usuario_2, contrasena, link
    - Add tracking columns: creado_por, fecha_creacion, ultima_edicion_por, fecha_ultima_edicion
    - Add foreign keys to usuarios table
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users to read
    - Add policies for authenticated users to insert/update
    - Add policies for admins to delete
*/

-- Drop existing table if it has wrong schema
DROP TABLE IF EXISTS accesos_nacional CASCADE;

-- Create table with correct schema
CREATE TABLE IF NOT EXISTS accesos_nacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aseguradora text NOT NULL,
  usuario_1 text NOT NULL,
  usuario_2 text,
  contrasena text NOT NULL,
  link text NOT NULL,
  creado_por uuid REFERENCES usuarios(id),
  fecha_creacion timestamptz DEFAULT now(),
  ultima_edicion_por uuid REFERENCES usuarios(id),
  fecha_ultima_edicion timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE accesos_nacional ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view accesos"
  ON accesos_nacional
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert accesos"
  ON accesos_nacional
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update accesos"
  ON accesos_nacional
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete accesos"
  ON accesos_nacional
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Create indexes
CREATE INDEX idx_accesos_nacional_aseguradora ON accesos_nacional(aseguradora);
CREATE INDEX idx_accesos_nacional_creado_por ON accesos_nacional(creado_por);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_accesos_nacional_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accesos_nacional_updated_at
  BEFORE UPDATE ON accesos_nacional
  FOR EACH ROW
  EXECUTE FUNCTION update_accesos_nacional_updated_at();
