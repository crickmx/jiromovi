/*
  # Crear vendor_mapping_persistent
  
  ## Descripción
  Tabla para almacenar mappings persistentes entre vendor_key y usuarios MOVI
  
  ## Cambios
  1. Crear tabla vendor_mapping_persistent
  2. Migrar datos desde vendor_mappings
  3. Crear función para sincronizar
*/

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS vendor_mapping_persistent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_key text NOT NULL,
  vendor_name_raw text,
  vendor_email_raw text,
  movi_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  match_source text NOT NULL DEFAULT 'manual' CHECK (match_source IN ('manual', 'auto_email', 'auto_name', 'imported')),
  assigned_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índice único en vendor_key (solo puede haber un mapping activo por vendor)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_mapping_vendor_key_unique 
  ON vendor_mapping_persistent(vendor_key) 
  WHERE is_active = true;

-- Índice en movi_user_id para búsquedas inversas
CREATE INDEX IF NOT EXISTS idx_vendor_mapping_movi_user_id 
  ON vendor_mapping_persistent(movi_user_id);

-- Índice en vendor_name_raw para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_vendor_mapping_vendor_name_raw 
  ON vendor_mapping_persistent(vendor_name_raw);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_vendor_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_mapping_updated_at ON vendor_mapping_persistent;
CREATE TRIGGER trigger_vendor_mapping_updated_at
  BEFORE UPDATE ON vendor_mapping_persistent
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_mapping_updated_at();

-- RLS
ALTER TABLE vendor_mapping_persistent ENABLE ROW LEVEL SECURITY;

-- Policy: todos los autenticados pueden leer
DROP POLICY IF EXISTS "Authenticated users can view vendor mappings" ON vendor_mapping_persistent;
CREATE POLICY "Authenticated users can view vendor mappings"
  ON vendor_mapping_persistent
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: solo admins pueden insertar
DROP POLICY IF EXISTS "Admins can create vendor mappings" ON vendor_mapping_persistent;
CREATE POLICY "Admins can create vendor mappings"
  ON vendor_mapping_persistent
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Policy: solo admins pueden actualizar
DROP POLICY IF EXISTS "Admins can update vendor mappings" ON vendor_mapping_persistent;
CREATE POLICY "Admins can update vendor mappings"
  ON vendor_mapping_persistent
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Policy: solo admins pueden eliminar
DROP POLICY IF EXISTS "Admins can delete vendor mappings" ON vendor_mapping_persistent;
CREATE POLICY "Admins can delete vendor mappings"
  ON vendor_mapping_persistent
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Migrar datos desde vendor_mappings a vendor_mapping_persistent
INSERT INTO vendor_mapping_persistent (
  vendor_key,
  movi_user_id,
  match_source,
  assigned_by,
  is_active,
  created_at
)
SELECT 
  CASE 
    WHEN source_type = 'name' THEN 'name:' || source_value
    WHEN source_type = 'email' THEN 'email:' || source_value
    ELSE source_value
  END as vendor_key,
  movi_user_id,
  'imported',
  created_by,
  (status = 'active'),
  created_at
FROM vendor_mappings
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_mapping_persistent vmp
  WHERE vmp.vendor_key = CASE 
    WHEN vendor_mappings.source_type = 'name' THEN 'name:' || vendor_mappings.source_value
    WHEN vendor_mappings.source_type = 'email' THEN 'email:' || vendor_mappings.source_value
    ELSE vendor_mappings.source_value
  END
  AND vmp.is_active = true
);

-- Función para sincronizar vendor_mappings -> vendor_mapping_persistent
CREATE OR REPLACE FUNCTION sync_vendor_mapping_to_persistent()
RETURNS TRIGGER AS $$
BEGIN
  -- Al insertar o actualizar en vendor_mappings, sincronizar a vendor_mapping_persistent
  INSERT INTO vendor_mapping_persistent (
    vendor_key,
    movi_user_id,
    match_source,
    assigned_by,
    is_active
  ) VALUES (
    CASE 
      WHEN NEW.source_type = 'name' THEN 'name:' || NEW.source_value
      WHEN NEW.source_type = 'email' THEN 'email:' || NEW.source_value
      ELSE NEW.source_value
    END,
    NEW.movi_user_id,
    'manual',
    NEW.created_by,
    (NEW.status = 'active')
  )
  ON CONFLICT (vendor_key) WHERE is_active = true
  DO UPDATE SET
    movi_user_id = EXCLUDED.movi_user_id,
    assigned_by = EXCLUDED.assigned_by,
    is_active = EXCLUDED.is_active,
    usage_count = vendor_mapping_persistent.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_vendor_mapping ON vendor_mappings;
CREATE TRIGGER sync_vendor_mapping
  AFTER INSERT OR UPDATE ON vendor_mappings
  FOR EACH ROW
  EXECUTE FUNCTION sync_vendor_mapping_to_persistent();