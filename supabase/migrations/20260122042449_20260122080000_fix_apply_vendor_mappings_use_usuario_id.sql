/*
  # Actualizar apply_vendor_mappings_to_batch para usar usuario_id
  
  1. Cambio
    - commission_details ahora usa usuario_id en lugar de agent_id
    - Actualizar función para reflejar este cambio
    
  2. Beneficio
    - Consistente con la unificación de commission_agents
*/

DROP FUNCTION IF EXISTS apply_vendor_mappings_to_batch(UUID);

CREATE OR REPLACE FUNCTION apply_vendor_mappings_to_batch(batch_id_param UUID)
RETURNS TABLE (
  total_processed INTEGER,
  matched INTEGER,
  still_unmatched INTEGER
) AS $$
DECLARE
  total_count INTEGER := 0;
  matched_count INTEGER := 0;
  unmatched_count INTEGER := 0;
  detail_record RECORD;
  mapping_result RECORD;
BEGIN
  -- Procesar cada detalle sin match
  FOR detail_record IN
    SELECT id, vendor_email_raw, vendor_name_raw
    FROM commission_details
    WHERE batch_id = batch_id_param
      AND (is_unmatched = true OR usuario_id IS NULL OR match_method IS NULL)
  LOOP
    total_count := total_count + 1;

    -- Buscar mapeo
    SELECT * INTO mapping_result
    FROM find_vendor_mapping(detail_record.vendor_email_raw, detail_record.vendor_name_raw);

    IF mapping_result.movi_user_id IS NOT NULL THEN
      -- Actualizar el detalle con el match encontrado (ahora usa usuario_id)
      UPDATE commission_details
      SET
        usuario_id = mapping_result.movi_user_id,
        match_method = mapping_result.match_method,
        is_unmatched = false,
        updated_at = NOW()
      WHERE id = detail_record.id;

      matched_count := matched_count + 1;
    ELSE
      -- Sigue sin match
      UPDATE commission_details
      SET
        is_unmatched = true,
        match_method = 'none',
        updated_at = NOW()
      WHERE id = detail_record.id;

      unmatched_count := unmatched_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT total_count, matched_count, unmatched_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION apply_vendor_mappings_to_batch 
  IS 'Aplica mapeos de vendedores a un lote de comisiones. Actualizado para usar usuario_id en lugar de agent_id';
