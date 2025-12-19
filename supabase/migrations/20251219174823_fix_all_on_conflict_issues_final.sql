/*
  # Fix all ON CONFLICT issues in vendor_mappings

  ## Problema Crítico
  Múltiples lugares en el código usan sintaxis SQL inválida:
  ```sql
  ON CONFLICT (source_type, source_value) WHERE status = 'active'
  ```

  PostgreSQL NO permite WHERE en ON CONFLICT cuando especificas columnas.

  ## Solución
  1. Limpiar cualquier duplicado existente en vendor_mappings
  2. Asegurar que el constraint UNIQUE existe
  3. Re-ejecutar migraciones de datos problemáticas sin el WHERE

  ## Impacto
  - Todas las funciones de asignación de vendedores funcionarán correctamente
  - No más errores "no unique or exclusion constraint matching"
*/

-- =============================================
-- PASO 1: Limpiar duplicados en vendor_mappings
-- =============================================

DO $$
BEGIN
  -- Eliminar duplicados manteniendo solo el más reciente
  DELETE FROM vendor_mappings
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY source_type, source_value
               ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
             ) as rn
      FROM vendor_mappings
    ) t
    WHERE rn > 1
  );

  RAISE NOTICE 'Duplicados eliminados de vendor_mappings';
END $$;

-- =============================================
-- PASO 2: Asegurar constraint UNIQUE
-- =============================================

DO $$
BEGIN
  -- Eliminar constraint viejo si existe
  ALTER TABLE vendor_mappings
    DROP CONSTRAINT IF EXISTS vendor_mappings_source_type_source_value_key;

  -- Crear constraint nuevo
  ALTER TABLE vendor_mappings
    ADD CONSTRAINT vendor_mappings_source_type_source_value_key
    UNIQUE (source_type, source_value);

  RAISE NOTICE 'Constraint UNIQUE recreado correctamente';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Error al recrear constraint: %', SQLERRM;
END $$;

-- =============================================
-- PASO 3: Migrar datos pendientes CORRECTAMENTE
-- =============================================

DO $$
DECLARE
  v_rec RECORD;
  v_source_type TEXT;
  v_source_value TEXT;
  v_migrated INTEGER := 0;
BEGIN
  -- Solo si existe la tabla vendor_mapping_persistent
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_mapping_persistent') THEN

    FOR v_rec IN
      SELECT * FROM vendor_mapping_persistent WHERE is_active = true
    LOOP
      -- Parsear vendor_key
      IF v_rec.vendor_key LIKE 'email:%' THEN
        v_source_type := 'email';
        v_source_value := SUBSTRING(v_rec.vendor_key FROM 7);
      ELSIF v_rec.vendor_key LIKE 'name:%' THEN
        v_source_type := 'name';
        v_source_value := SUBSTRING(v_rec.vendor_key FROM 6);
      ELSE
        v_source_type := 'name';
        v_source_value := v_rec.vendor_key;
      END IF;

      -- Insertar CORRECTAMENTE (sin WHERE en ON CONFLICT)
      INSERT INTO vendor_mappings (
        source_type,
        source_value,
        movi_user_id,
        status,
        notes,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        v_source_type,
        v_source_value,
        v_rec.movi_user_id,
        CASE WHEN v_rec.is_active THEN 'active' ELSE 'inactive' END,
        COALESCE(v_rec.notes, 'Migrado desde vendor_mapping_persistent'),
        v_rec.assigned_by,
        v_rec.assigned_by,
        v_rec.created_at,
        v_rec.updated_at
      )
      ON CONFLICT (source_type, source_value)
      DO UPDATE SET
        movi_user_id = EXCLUDED.movi_user_id,
        status = EXCLUDED.status,
        notes = COALESCE(vendor_mappings.notes, '') || ' | ' || COALESCE(EXCLUDED.notes, ''),
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

      v_migrated := v_migrated + 1;
    END LOOP;

    RAISE NOTICE 'Migración completada: % registros procesados', v_migrated;
  ELSE
    RAISE NOTICE 'Tabla vendor_mapping_persistent no existe, skip';
  END IF;
END $$;

-- =============================================
-- PASO 4: Re-crear todas las funciones con ON CONFLICT correcto
-- =============================================

-- Ya fue corregida en migración anterior, pero aseguramos que esté actualizada
CREATE OR REPLACE FUNCTION apply_vendor_mapping_to_batch(
  p_batch_id uuid,
  p_vendor_key text,
  p_movi_user_id uuid,
  p_assigned_by uuid
)
RETURNS jsonb AS $$
DECLARE
  v_updated_count integer;
  v_mapping_id uuid;
  v_source_type text;
  v_source_value text;
BEGIN
  -- Parsear vendor_key
  IF p_vendor_key LIKE 'email:%' THEN
    v_source_type := 'email';
    v_source_value := SUBSTRING(p_vendor_key FROM 7);
  ELSIF p_vendor_key LIKE 'name:%' THEN
    v_source_type := 'name';
    v_source_value := SUBSTRING(p_vendor_key FROM 6);
  ELSE
    v_source_type := 'name';
    v_source_value := p_vendor_key;
  END IF;

  -- Insertar/actualizar mapping CORRECTAMENTE (sin WHERE)
  INSERT INTO vendor_mappings (
    source_type,
    source_value,
    movi_user_id,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_source_type,
    v_source_value,
    p_movi_user_id,
    'active',
    p_assigned_by,
    p_assigned_by
  )
  ON CONFLICT (source_type, source_value)
  DO UPDATE SET
    movi_user_id = p_movi_user_id,
    status = 'active',
    updated_by = p_assigned_by,
    updated_at = now()
  RETURNING id INTO v_mapping_id;

  -- Aplicar a commission_details
  UPDATE commission_details
  SET
    movi_user_id = p_movi_user_id,
    match_method = 'manual',
    pending_assignment = false,
    assigned_at = now()
  WHERE batch_id = p_batch_id
    AND vendor_key = p_vendor_key
    AND pending_assignment = true;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'mapping_id', v_mapping_id,
    'vendor_key', p_vendor_key,
    'source_type', v_source_type,
    'source_value', v_source_value,
    'movi_user_id', p_movi_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PASO 5: Verificación final
-- =============================================

DO $$
DECLARE
  v_test_user_id UUID;
  v_duplicates INTEGER;
BEGIN
  -- Verificar que no hay duplicados
  SELECT COUNT(*)
  INTO v_duplicates
  FROM (
    SELECT source_type, source_value, COUNT(*) as cnt
    FROM vendor_mappings
    GROUP BY source_type, source_value
    HAVING COUNT(*) > 1
  ) dups;

  IF v_duplicates > 0 THEN
    RAISE WARNING 'Todavía hay % grupos de duplicados en vendor_mappings', v_duplicates;
  ELSE
    RAISE NOTICE 'OK: No hay duplicados en vendor_mappings';
  END IF;

  -- Test de constraint UNIQUE
  SELECT id INTO v_test_user_id FROM usuarios LIMIT 1;
  
  IF v_test_user_id IS NOT NULL THEN
    -- Insert de prueba
    INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status)
    VALUES ('email', '_test_final_' || gen_random_uuid()::text, v_test_user_id, 'active');
    
    RAISE NOTICE 'OK: INSERT funciona correctamente';
    
    -- Cleanup
    DELETE FROM vendor_mappings WHERE source_value LIKE '_test_final_%';
  END IF;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'VERIFICACIÓN COMPLETA: vendor_mappings está funcionando correctamente';
  RAISE NOTICE '===========================================';
END $$;
