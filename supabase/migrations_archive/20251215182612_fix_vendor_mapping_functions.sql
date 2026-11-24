/*
  # Recrear Funciones de Mapeo de Vendedores

  Elimina las funciones existentes y las recrea con las firmas correctas
*/

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS get_unmatched_vendors_by_batch(UUID);
DROP FUNCTION IF EXISTS apply_vendor_mappings_to_batch(UUID);
DROP FUNCTION IF EXISTS assign_vendor_manually(UUID, TEXT, UUID, BOOLEAN, UUID);

-- =============================================
-- FUNCIÓN: get_unmatched_vendors_by_batch
-- =============================================
CREATE OR REPLACE FUNCTION get_unmatched_vendors_by_batch(batch_id_param UUID)
RETURNS TABLE(
  vendor_key TEXT,
  vendor_type TEXT,
  vendor_email TEXT,
  vendor_name TEXT,
  polizas_count BIGINT,
  total_commission NUMERIC,
  example_polizas JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cd.vendor_key,
    CASE 
      WHEN cd.vendor_key LIKE 'email:%' THEN 'email'
      WHEN cd.vendor_key LIKE 'name:%' THEN 'name'
      ELSE 'unknown'
    END::TEXT as vendor_type,
    COALESCE(cd.vendor_email_raw, '')::TEXT as vendor_email,
    COALESCE(cd.vendor_name_raw, '')::TEXT as vendor_name,
    COUNT(cd.id)::BIGINT as polizas_count,
    SUM(cd.commission_neta)::NUMERIC as total_commission,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', cd.id,
        'poliza', cd.poliza,
        'ramo', cd.ramo,
        'aseguradora', cd.aseguradora,
        'prima_neta', cd.prima_neta,
        'commission_neta', cd.commission_neta
      ) 
      ORDER BY cd.created_at DESC
    ) FILTER (WHERE cd.id IS NOT NULL) AS example_polizas
  FROM commission_details cd
  WHERE cd.batch_id = batch_id_param
    AND cd.is_unmatched = true
    AND cd.vendor_key IS NOT NULL
  GROUP BY cd.vendor_key, cd.vendor_email_raw, cd.vendor_name_raw
  ORDER BY polizas_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCIÓN: apply_vendor_mappings_to_batch
-- =============================================
CREATE OR REPLACE FUNCTION apply_vendor_mappings_to_batch(batch_id_param UUID)
RETURNS TABLE(
  total_processed BIGINT,
  matched BIGINT,
  still_unmatched BIGINT
) AS $$
DECLARE
  v_total_processed BIGINT := 0;
  v_matched BIGINT := 0;
  v_still_unmatched BIGINT := 0;
  v_matched_name BIGINT := 0;
BEGIN
  SELECT COUNT(*) INTO v_total_processed
  FROM commission_details
  WHERE batch_id = batch_id_param
    AND is_unmatched = true;

  WITH updated_email AS (
    UPDATE commission_details cd
    SET 
      agent_id = vm.movi_user_id,
      match_method = 'mapping_email',
      is_unmatched = false
    FROM vendor_mappings vm
    WHERE cd.batch_id = batch_id_param
      AND cd.is_unmatched = true
      AND cd.vendor_key IS NOT NULL
      AND cd.vendor_key LIKE 'email:%'
      AND vm.source_type = 'email'
      AND vm.status = 'active'
      AND vm.source_value = SUBSTRING(cd.vendor_key FROM 7)
    RETURNING cd.id
  )
  SELECT COUNT(*) INTO v_matched FROM updated_email;

  WITH updated_name AS (
    UPDATE commission_details cd
    SET 
      agent_id = vm.movi_user_id,
      match_method = 'mapping_name',
      is_unmatched = false
    FROM vendor_mappings vm
    WHERE cd.batch_id = batch_id_param
      AND cd.is_unmatched = true
      AND cd.vendor_key IS NOT NULL
      AND cd.vendor_key LIKE 'name:%'
      AND vm.source_type = 'name'
      AND vm.status = 'active'
      AND vm.source_value = SUBSTRING(cd.vendor_key FROM 6)
    RETURNING cd.id
  )
  SELECT COUNT(*) INTO v_matched_name FROM updated_name;
  
  v_matched := v_matched + v_matched_name;

  SELECT COUNT(*) INTO v_still_unmatched
  FROM commission_details
  WHERE batch_id = batch_id_param
    AND is_unmatched = true;

  RETURN QUERY SELECT v_total_processed, v_matched, v_still_unmatched;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCIÓN: assign_vendor_manually
-- =============================================
CREATE OR REPLACE FUNCTION assign_vendor_manually(
  batch_id_param UUID,
  vendor_key_param TEXT,
  movi_user_id_param UUID,
  save_mapping BOOLEAN,
  created_by_param UUID
)
RETURNS TABLE(
  updated_count BIGINT,
  mapping_created BOOLEAN
) AS $$
DECLARE
  v_updated_count BIGINT := 0;
  v_mapping_created BOOLEAN := false;
  v_source_type TEXT;
  v_source_value TEXT;
  v_example_email TEXT;
  v_example_name TEXT;
BEGIN
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

  IF save_mapping AND v_updated_count > 0 THEN
    IF vendor_key_param LIKE 'email:%' THEN
      v_source_type := 'email';
      v_source_value := SUBSTRING(vendor_key_param FROM 7);
    ELSIF vendor_key_param LIKE 'name:%' THEN
      v_source_type := 'name';
      v_source_value := SUBSTRING(vendor_key_param FROM 6);
    END IF;

    IF v_source_type IS NOT NULL THEN
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
      WHERE status = 'active'
      DO UPDATE SET
        movi_user_id = movi_user_id_param,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;