/*
  # Sincronizar Mapeos de SICAS a Vendor Mappings

  1. Problem
    - Los mapeos de SICAS (sicas_mapeo_vendedor_usuario) no se sincronizan automáticamente con vendor_mappings
    - Esto causa que los vendedores mapeados en SICAS no sean reconocidos al cargar Excels de comisiones
    
  2. Changes
    - Crear función para sincronizar mapeos de SICAS → vendor_mappings
    - Crear trigger que ejecute esta sincronización automáticamente
    - Sincronizar los mapeos existentes
    - Actualizar el flag is_mapped en sicas_catalogos
    
  3. Security
    - Función SECURITY DEFINER para poder escribir en vendor_mappings
*/

-- ============================================
-- FUNCIÓN PARA SINCRONIZAR MAPEOS DE SICAS
-- ============================================

CREATE OR REPLACE FUNCTION sync_sicas_mapping_to_vendor_mappings()
RETURNS TRIGGER AS $$
DECLARE
  vendor_nombre TEXT;
  normalized_nombre TEXT;
BEGIN
  -- Obtener el nombre del vendedor desde sicas_catalogos
  SELECT nombre INTO vendor_nombre
  FROM sicas_catalogos
  WHERE catalog_type_id = NEW.catalog_type_id
    AND id_sicas = NEW.id_sicas_vendedor
  LIMIT 1;

  IF vendor_nombre IS NULL THEN
    -- Si no se encuentra en catálogos, no hacer nada
    RETURN NEW;
  END IF;

  -- Normalizar el nombre
  normalized_nombre := normalize_name(vendor_nombre);

  IF normalized_nombre IS NULL OR normalized_nombre = '' THEN
    RETURN NEW;
  END IF;

  -- Verificar si ya existe un mapeo activo para este nombre
  IF EXISTS (
    SELECT 1 FROM vendor_mappings
    WHERE source_type = 'name'
      AND source_value = normalized_nombre
      AND status = 'active'
  ) THEN
    -- Actualizar el mapeo existente
    UPDATE vendor_mappings
    SET 
      movi_user_id = NEW.movi_user_id,
      updated_by = NEW.mapped_by,
      updated_at = NOW(),
      notes = COALESCE(notes, '') || ' | Sincronizado desde SICAS mapeo vendedor ID: ' || NEW.id_sicas_vendedor
    WHERE source_type = 'name'
      AND source_value = normalized_nombre
      AND status = 'active';
  ELSE
    -- Crear nuevo mapeo
    INSERT INTO vendor_mappings (
      source_type,
      source_value,
      movi_user_id,
      status,
      created_by,
      notes
    ) VALUES (
      'name',
      normalized_nombre,
      NEW.movi_user_id,
      'active',
      NEW.mapped_by,
      'Sincronizado desde SICAS mapeo vendedor ID: ' || NEW.id_sicas_vendedor
    );
  END IF;

  -- Actualizar el flag is_mapped en sicas_catalogos
  UPDATE sicas_catalogos
  SET is_mapped = true
  WHERE catalog_type_id = NEW.catalog_type_id
    AND id_sicas = NEW.id_sicas_vendedor;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER PARA SINCRONIZACIÓN AUTOMÁTICA
-- ============================================

DROP TRIGGER IF EXISTS trigger_sync_sicas_mapping_to_vendor_mappings 
  ON sicas_mapeo_vendedor_usuario;

CREATE TRIGGER trigger_sync_sicas_mapping_to_vendor_mappings
AFTER INSERT OR UPDATE ON sicas_mapeo_vendedor_usuario
FOR EACH ROW
EXECUTE FUNCTION sync_sicas_mapping_to_vendor_mappings();

-- ============================================
-- SINCRONIZAR MAPEOS EXISTENTES
-- ============================================

-- Insertar mapeos para los 3 vendedores que ya están mapeados
INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status, created_by, notes)
SELECT 
  'name' as source_type,
  normalize_name(sc.nombre) as source_value,
  smv.movi_user_id,
  'active' as status,
  smv.mapped_by as created_by,
  'Sincronizado desde SICAS mapeo vendedor ID: ' || smv.id_sicas_vendedor as notes
FROM sicas_mapeo_vendedor_usuario smv
JOIN sicas_catalogos sc ON sc.id_sicas = smv.id_sicas_vendedor AND sc.catalog_type_id = smv.catalog_type_id
WHERE smv.id_sicas_vendedor IN ('26', '78', '265')
  AND NOT EXISTS (
    SELECT 1 FROM vendor_mappings vm
    WHERE vm.source_type = 'name'
      AND vm.source_value = normalize_name(sc.nombre)
      AND vm.status = 'active'
  );

-- Actualizar is_mapped en sicas_catalogos
UPDATE sicas_catalogos
SET is_mapped = true
WHERE catalog_type_id = 32
  AND id_sicas IN ('26', '78', '265');

COMMENT ON FUNCTION sync_sicas_mapping_to_vendor_mappings IS 
'Sincroniza automáticamente los mapeos de SICAS (sicas_mapeo_vendedor_usuario) a vendor_mappings para que sean reconocidos en el módulo de comisiones.';
