/*
  # Add Payment Information Fields

  1. New Tables
    - `esquemas_pago`
      - `id` (uuid, primary key)
      - `nombre` (text, unique, required) - Payment scheme name
      - `activo` (boolean, default true) - Active status
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to existing tables
    - Add to `usuarios` table:
      - `esquema_pago_id` (uuid, foreign key to esquemas_pago)
      - `banco` (text) - Bank name
      - `clabe` (text) - CLABE/bank account number

  3. Security
    - Enable RLS on `esquemas_pago` table
    - Authenticated users can view all payment schemes
    - Only admins can create/update/delete payment schemes
    - Payment information in usuarios follows existing RLS policies

  4. Initial Data
    - Insert default payment schemes: Nómina, Externo, Factura

  5. Important Notes
    - Payment schemes are shared across all users
    - Inactive schemes are still available for existing users but hidden for new selections
    - CLABE is stored as text to preserve leading zeros and formatting
*/

-- Create esquemas_pago table
CREATE TABLE IF NOT EXISTS esquemas_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add payment fields to usuarios table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'esquema_pago_id'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN esquema_pago_id uuid REFERENCES esquemas_pago(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'banco'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN banco text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'clabe'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN clabe text DEFAULT '';
  END IF;
END $$;

-- Insert default payment schemes
INSERT INTO esquemas_pago (nombre) VALUES
  ('Nómina'),
  ('Externo'),
  ('Factura')
ON CONFLICT (nombre) DO NOTHING;

-- Enable RLS on esquemas_pago
ALTER TABLE esquemas_pago ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view payment schemes
CREATE POLICY "Authenticated users can view payment schemes"
  ON esquemas_pago FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert payment schemes
CREATE POLICY "Admins can insert payment schemes"
  ON esquemas_pago FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Only admins can update payment schemes
CREATE POLICY "Admins can update payment schemes"
  ON esquemas_pago FOR UPDATE
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

-- Only admins can delete payment schemes
CREATE POLICY "Admins can delete payment schemes"
  ON esquemas_pago FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_esquema_pago_id ON usuarios(esquema_pago_id);
CREATE INDEX IF NOT EXISTS idx_esquemas_pago_activo ON esquemas_pago(activo);
