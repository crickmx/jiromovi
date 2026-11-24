/*
  # Arreglar constraint UNIQUE en vendor_mappings
  
  1. Problema
    - vendor_mappings_source_type_source_value_key es UNIQUE sin condición
    - No permite reasignar un vendedor que ya fue mapeado antes
    - Impide tener histórico de mapeos
    
  2. Solución
    - Hacer el constraint UNIQUE PARCIAL
    - Solo aplicar a registros con status='active'
    - Permitir múltiples registros inactivos del mismo vendedor
    
  3. Beneficio
    - Permite reasignar vendedores
    - Mantiene histórico completo
    - Garantiza solo 1 mapeo activo por vendedor
*/

-- =============================================
-- PASO 1: Eliminar constraint UNIQUE global
-- =============================================

ALTER TABLE vendor_mappings 
  DROP CONSTRAINT IF EXISTS vendor_mappings_source_type_source_value_key;

-- =============================================
-- PASO 2: Crear constraint UNIQUE PARCIAL para activos
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_mappings_unique_active_source
  ON vendor_mappings(source_type, source_value)
  WHERE status = 'active';

COMMENT ON INDEX idx_vendor_mappings_unique_active_source 
  IS 'Garantiza que solo puede haber 1 mapeo activo por (source_type, source_value). Permite múltiples inactivos para histórico';

-- =============================================
-- PASO 3: Verificar datos actuales
-- =============================================

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT source_type, source_value, COUNT(*) as cnt
    FROM vendor_mappings
    WHERE status = 'active'
    GROUP BY source_type, source_value
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'Existen % combinaciones duplicadas activas - se deben resolver manualmente', duplicate_count;
  ELSE
    RAISE NOTICE '✓ No hay duplicados activos - constraint aplicado correctamente';
  END IF;
END $$;

-- =============================================
-- PASO 4: Documentación
-- =============================================

COMMENT ON TABLE vendor_mappings IS 'Mapeos de vendedores no reconocidos a usuarios MOVI. 
Un vendedor (source_type, source_value) solo puede tener 1 mapeo ACTIVO, pero puede tener múltiples INACTIVOS para histórico.
Un usuario MOVI solo puede tener 1 mapeo ACTIVO (enforced por idx_vendor_mappings_unique_active_user).';
