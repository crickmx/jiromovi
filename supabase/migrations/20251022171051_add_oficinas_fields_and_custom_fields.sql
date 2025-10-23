/*
  # Add New Fields to Oficinas and Custom Fields Support

  1. Changes to Tables
    - Add new fields to `oficinas` table:
      - `director` (text) - Name of office director
      - `gerente` (text) - Name of office manager
      - `telefono` (text) - Office phone number
      - `email` (text) - Office email address
      - `domicilio` (text) - Office physical address
      - `facebook` (text) - Facebook URL
      - `instagram` (text) - Instagram URL
    
    - Create `campos_personalizados_oficinas` table:
      - `id` (uuid, primary key)
      - `nombre_campo` (text) - Custom field name
      - `tipo` (text) - Field type (text, number, date, etc.)
      - `activo` (boolean) - Whether field is active
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - Create `valores_campos_oficinas` table:
      - `id` (uuid, primary key)
      - `oficina_id` (uuid) - Foreign key to oficinas
      - `campo_id` (uuid) - Foreign key to campos_personalizados_oficinas
      - `valor` (text) - Field value
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on new tables
    - Add policies for authenticated users to read
    - Add policies for administrators to manage data

  3. Important Notes
    - All new fields have default empty string values
    - Custom fields system mirrors the usuarios custom fields structure
    - Uses safe ALTER TABLE with IF NOT EXISTS checks
*/

-- Add new fields to oficinas table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'director'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN director text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'gerente'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN gerente text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'telefono'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN telefono text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'email'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN email text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'domicilio'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN domicilio text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'facebook'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN facebook text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'instagram'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN instagram text DEFAULT '';
  END IF;
END $$;

-- Create custom fields table for oficinas
CREATE TABLE IF NOT EXISTS campos_personalizados_oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_campo text NOT NULL,
  tipo text NOT NULL DEFAULT 'text',
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create values table for custom fields
CREATE TABLE IF NOT EXISTS valores_campos_oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  campo_id uuid NOT NULL REFERENCES campos_personalizados_oficinas(id) ON DELETE CASCADE,
  valor text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(oficina_id, campo_id)
);

-- Enable RLS on new tables
ALTER TABLE campos_personalizados_oficinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE valores_campos_oficinas ENABLE ROW LEVEL SECURITY;

-- Policies for campos_personalizados_oficinas
CREATE POLICY "Authenticated users can read custom fields"
  ON campos_personalizados_oficinas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Administrators can insert custom fields"
  ON campos_personalizados_oficinas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administrators can update custom fields"
  ON campos_personalizados_oficinas FOR UPDATE
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

CREATE POLICY "Administrators can delete custom fields"
  ON campos_personalizados_oficinas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Policies for valores_campos_oficinas
CREATE POLICY "Authenticated users can read field values"
  ON valores_campos_oficinas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Administrators can insert field values"
  ON valores_campos_oficinas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administrators can update field values"
  ON valores_campos_oficinas FOR UPDATE
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

CREATE POLICY "Administrators can delete field values"
  ON valores_campos_oficinas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );
