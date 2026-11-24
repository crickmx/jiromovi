/*
  # Fix vendor_mappings UNIQUE Constraint

  ## Problema
  La función edge `assign-vendor-staging` falla con error:
  "there is no unique or exclusion constraint matching the ON CONFLICT specification"

  ## Causa
  La tabla tiene un índice UNIQUE parcial (con WHERE status='active')
  pero no tiene una constraint única simple que upsert pueda usar.

  ## Solución
  1. Eliminar el índice parcial si existe
  2. Asegurar que existe la constraint UNIQUE (source_type, source_value)
  3. Crear índices de soporte sin conflictos
*/

-- =============================================
-- PASO 1: Eliminar índice parcial que causa conflicto
-- =============================================

DROP INDEX IF EXISTS idx_vendor_mappings_unique_source;

-- =============================================
-- PASO 2: Asegurar que existe la constraint única
-- =============================================

-- Primero verificar si la constraint ya existe
DO $$
BEGIN
  -- Si no existe la constraint, agregarla
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vendor_mappings_source_type_source_value_key'
      AND table_name = 'vendor_mappings'
  ) THEN
    -- Intentar agregar la constraint
    BEGIN
      ALTER TABLE vendor_mappings
        ADD CONSTRAINT vendor_mappings_source_type_source_value_key
        UNIQUE (source_type, source_value);

      RAISE NOTICE 'Constraint UNIQUE agregada exitosamente';
    EXCEPTION WHEN unique_violation THEN
      -- Si hay duplicados, eliminarlos primero
      RAISE NOTICE 'Duplicados encontrados, limpiando...';

      -- Eliminar duplicados manteniendo solo el más reciente
      DELETE FROM vendor_mappings
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY source_type, source_value
                   ORDER BY updated_at DESC, created_at DESC
                 ) as rn
          FROM vendor_mappings
        ) t
        WHERE rn > 1
      );

      -- Intentar agregar la constraint nuevamente
      ALTER TABLE vendor_mappings
        ADD CONSTRAINT vendor_mappings_source_type_source_value_key
        UNIQUE (source_type, source_value);

      RAISE NOTICE 'Constraint UNIQUE agregada después de limpiar duplicados';
    END;
  ELSE
    RAISE NOTICE 'Constraint UNIQUE ya existe';
  END IF;
END $$;

-- =============================================
-- PASO 3: Crear índices de soporte (sin conflictos)
-- =============================================

-- Índice para búsquedas por usuario
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_user_id
  ON vendor_mappings(movi_user_id)
  WHERE status = 'active';

-- Índice para búsquedas por tipo y estado
CREATE INDEX IF NOT EXISTS idx_vendor_mappings_type_status
  ON vendor_mappings(source_type, status)
  WHERE status = 'active';

-- =============================================
-- PASO 4: Verificación
-- =============================================

DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO constraint_count
  FROM information_schema.table_constraints
  WHERE table_name = 'vendor_mappings'
    AND constraint_type = 'UNIQUE'
    AND constraint_name LIKE '%source_type%source_value%';

  IF constraint_count > 0 THEN
    RAISE NOTICE 'Verificación exitosa: UNIQUE constraint existe en vendor_mappings';
  ELSE
    RAISE WARNING 'Verificación falló: No se encontró UNIQUE constraint';
  END IF;
END $$;
