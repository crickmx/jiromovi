/*
  # Fix assign_vendor_manually ON CONFLICT

  ## Problema
  La función assign_vendor_manually tiene sintaxis SQL inválida:
  ```sql
  ON CONFLICT (source_type, source_value) WHERE status = 'active'
  ```

  ## Solución
  Eliminar el WHERE del ON CONFLICT

  ## Impacto
  - La función assign_vendor_manually funcionará correctamente
  - Todos los sistemas de asignación de vendedores funcionarán sin errores
*/

CREATE OR REPLACE FUNCTION assign_vendor_manually(
  batch_id_param UUID,
  vendor_key_param TEXT,
  movi_user_id_param UUID,
  save_mapping BOOLEAN,
  created_by_param UUID
)
RETURNS TABLE (updated_count BIGINT, mapping_created BOOLEAN) AS $$
DECLARE
  v_updated_count BIGINT := 0;
  v_mapping_created BOOLEAN := false;
  v_source_type TEXT;
  v_source_value TEXT;
  v_example_email TEXT;
  v_example_name TEXT;
BEGIN
  -- Actualizar commission_details
  WITH updated AS (
    UPDATE commission_details
    SET 
      agent_id = movi_user_id_param,
      match_method = 'manual',
      is_unmatched = false
    WHERE batch_id = batch_id_param
      AND vendor_key = vendor_key_param
      AND is_unmatched = true
    RETURNING id, vendor_email_raw, vendor_name_raw
  )
  SELECT 
    COUNT(*),
    MAX(vendor_email_raw),
    MAX(vendor_name_raw)
  INTO v_updated_count, v_example_email, v_example_name
  FROM updated;

  -- Guardar mapping si se solicita
  IF save_mapping AND v_updated_count > 0 THEN
    -- Parsear vendor_key
    IF vendor_key_param LIKE 'email:%' THEN
      v_source_type := 'email';
      v_source_value := SUBSTRING(vendor_key_param FROM 7);
    ELSIF vendor_key_param LIKE 'name:%' THEN
      v_source_type := 'name';
      v_source_value := SUBSTRING(vendor_key_param FROM 6);
    END IF;

    IF v_source_type IS NOT NULL THEN
      -- FIX: Eliminar WHERE del ON CONFLICT
      INSERT INTO vendor_mappings (
        source_type,
        source_value,
        source_raw_examples,
        movi_user_id,
        status,
        created_by,
        updated_by
      )
      VALUES (
        v_source_type,
        v_source_value,
        JSONB_BUILD_ARRAY(
          JSONB_BUILD_OBJECT(
            'email', v_example_email,
            'name', v_example_name
          )
        ),
        movi_user_id_param,
        'active',
        created_by_param,
        created_by_param
      )
      ON CONFLICT (source_type, source_value)
      DO UPDATE SET
        movi_user_id = movi_user_id_param,
        status = 'active',
        updated_by = created_by_param,
        updated_at = NOW(),
        source_raw_examples = vendor_mappings.source_raw_examples || JSONB_BUILD_ARRAY(
          JSONB_BUILD_OBJECT(
            'email', v_example_email,
            'name', v_example_name
          )
        );

      v_mapping_created := true;
    END IF;
  END IF;

  RETURN QUERY SELECT v_updated_count, v_mapping_created;
END;
$$ LANGUAGE plpgsql;

-- Verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Función assign_vendor_manually corregida';
END $$;
