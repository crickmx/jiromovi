/*
  # Sistema de Mapeo de Vendedores No Reconocidos

  1. Nueva Tabla: vendor_mappings
    - Guarda relaciones persistentes entre vendedores externos y usuarios MOVI
    - Permite mapeo por email o por nombre
    - Incluye auditoría y estado activo/inactivo
    
  2. Actualización: commission_details
    - Agrega campos para tracking de vendedor original
    - Permite identificar método de matching usado
    - Marca pólizas no asignadas para resolución manual
    
  3. Funcionalidad
    - Auto-matching en procesamiento de lotes
    - Asignación manual por administradores
    - Persistencia para futuros lotes
    - Auditoría completa de cambios
*/

-- =============================================
-- TABLA: vendor_mappings
-- =============================================
CREATE TABLE IF NOT EXISTS vendor_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación del vendedor externo
  source_type text NOT NULL CHECK (source_type IN ('email', 'name')),
  source_value text NOT NULL, -- normalizado (lowercase, trimmed)
  source_raw_examples jsonb DEFAULT '[]'::jsonb, -- ejemplos de valores originales vistos
  
  -- Usuario MOVI asignado
  movi_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Estado y control
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text,
  
  -- Auditoría
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para vendor_mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_mappings_unique_source 
  ON vendor_mappings(source_type, source_value) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_user 
  ON vendor_mappings(movi_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_status 
  ON vendor_mappings(status);

-- =============================================
-- ACTUALIZAR: commission_details
-- =============================================

-- Agregar vendor_email_raw si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'vendor_email_raw'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN vendor_email_raw TEXT;
  END IF;
END $$;

-- Agregar vendor_name_raw si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'vendor_name_raw'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN vendor_name_raw TEXT;
  END IF;
END $$;

-- Agregar vendor_key si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'vendor_key'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN vendor_key TEXT;
  END IF;
END $$;

-- Agregar match_method si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'match_method'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN match_method TEXT 
    CHECK (match_method IN ('direct_email', 'mapping_email', 'mapping_name', 'manual', 'none'));
  END IF;
END $$;

-- Agregar is_unmatched si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'is_unmatched'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN is_unmatched BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Índices para commission_details vendor tracking
CREATE INDEX IF NOT EXISTS idx_commission_details_vendor_key 
  ON commission_details(vendor_key);

CREATE INDEX IF NOT EXISTS idx_commission_details_is_unmatched 
  ON commission_details(is_unmatched) 
  WHERE is_unmatched = true;

CREATE INDEX IF NOT EXISTS idx_commission_details_match_method 
  ON commission_details(match_method);

-- =============================================
-- RLS POLICIES: vendor_mappings
-- =============================================

ALTER TABLE vendor_mappings ENABLE ROW LEVEL SECURITY;

-- Administradores pueden ver todos los mapeos
CREATE POLICY "Admins can view all vendor mappings"
  ON vendor_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  );

-- Administradores pueden crear mapeos
CREATE POLICY "Admins can create vendor mappings"
  ON vendor_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  );

-- Administradores pueden actualizar mapeos
CREATE POLICY "Admins can update vendor mappings"
  ON vendor_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  );

-- Administradores pueden eliminar mapeos
CREATE POLICY "Admins can delete vendor mappings"
  ON vendor_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'administrador'
    )
  );

-- =============================================
-- TRIGGER: updated_at para vendor_mappings
-- =============================================

CREATE OR REPLACE FUNCTION update_vendor_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_mappings_updated_at ON vendor_mappings;

CREATE TRIGGER trigger_vendor_mappings_updated_at
  BEFORE UPDATE ON vendor_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_mappings_updated_at();