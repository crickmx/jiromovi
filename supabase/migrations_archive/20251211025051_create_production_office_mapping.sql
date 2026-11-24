/*
  # Crear sistema de mapeo de oficinas para producción

  1. Nueva Tabla
    - `production_office_mapping`
      - `id` (uuid, primary key)
      - `oficina_id` (uuid, FK a oficinas) - Oficina en la plataforma
      - `excel_office_name` (text) - Nombre exacto como aparece en el Excel
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Seguridad
    - Enable RLS
    - Solo administradores pueden gestionar el mapeo
    - Todos los usuarios autenticados pueden leer
  
  3. Índices
    - Índice único en oficina_id
    - Índice en excel_office_name para búsqueda rápida
*/

-- Crear tabla de mapeo
CREATE TABLE IF NOT EXISTS production_office_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  excel_office_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(oficina_id)
);

-- Índice para búsqueda rápida por nombre de Excel
CREATE INDEX IF NOT EXISTS idx_production_office_mapping_excel_name 
  ON production_office_mapping(excel_office_name);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_production_office_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_production_office_mapping_updated_at ON production_office_mapping;

CREATE TRIGGER update_production_office_mapping_updated_at
  BEFORE UPDATE ON production_office_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_production_office_mapping_updated_at();

-- Enable RLS
ALTER TABLE production_office_mapping ENABLE ROW LEVEL SECURITY;

-- Políticas: Todos pueden leer
CREATE POLICY "Users can read office mappings"
  ON production_office_mapping
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo administradores pueden insertar
CREATE POLICY "Admins can insert office mappings"
  ON production_office_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden actualizar
CREATE POLICY "Admins can update office mappings"
  ON production_office_mapping
  FOR UPDATE
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

-- Solo administradores pueden eliminar
CREATE POLICY "Admins can delete office mappings"
  ON production_office_mapping
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );