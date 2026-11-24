/*
  # Fix apply_vendor_mapping_to_batch ON CONFLICT

  ## Problema
  La función `apply_vendor_mapping_to_batch` usa:
  ```sql
  ON CONFLICT (source_type, source_value) WHERE status = 'active'
  ```

  Esto NO es válido en PostgreSQL. ON CONFLICT no puede tener WHERE clause
  cuando se usa con columnas específicas.

  ## Solución
  Usar el constraint UNIQUE directo que ya existe:
  ```sql
  ON CONFLICT (source_type, source_value)
  ```

  ## Impacto
  - Función apply_vendor_mapping_to_batch funcionará correctamente
  - assign-vendor-manual edge function funcionará sin errores
  - assign-vendor-staging edge function funcionará sin errores
*/

-- =============================================
-- Actualizar función apply_vendor_mapping_to_batch
-- =============================================

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
  -- Parsear vendor_key: "email:xxx" o "name:xxx"
  IF p_vendor_key LIKE 'email:%' THEN
    v_source_type := 'email';
    v_source_value := SUBSTRING(p_vendor_key FROM 7);
  ELSIF p_vendor_key LIKE 'name:%' THEN
    v_source_type := 'name';
    v_source_value := SUBSTRING(p_vendor_key FROM 6);
  ELSE
    -- Formato desconocido, asumir name
    v_source_type := 'name';
    v_source_value := p_vendor_key;
  END IF;

  -- Crear o actualizar el mapping en vendor_mappings (tabla unificada)
  -- FIX: Eliminar WHERE status = 'active' del ON CONFLICT
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

  -- Aplicar el mapping a todos los items del lote con ese vendor_key
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
-- Verificación
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'Función apply_vendor_mapping_to_batch actualizada correctamente';
  RAISE NOTICE 'El ON CONFLICT ahora usa el constraint correcto sin WHERE clause';
END $$;
