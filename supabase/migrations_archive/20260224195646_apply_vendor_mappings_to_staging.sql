/*
  # Apply Vendor Mappings to Staging

  1. New Functions
    - `apply_vendor_mappings_to_staging_session` - Aplica mapeos de vendedores a una sesión de staging
    
  2. Changes
    - Similar a `apply_vendor_mappings_to_batch` pero para `commission_items_staging`
    - Usa la función `find_vendor_mapping` existente
    - Actualiza `movi_user_id`, `match_method` y `pending_assignment`
    
  3. Security
    - SECURITY DEFINER para permitir actualizaciones
    - Solo administradores deberían llamar esta función
*/

-- Crear función para aplicar mapeos a staging
CREATE OR REPLACE FUNCTION apply_vendor_mappings_to_staging_session(p_session_id UUID)
RETURNS TABLE (
  total_processed INTEGER,
  matched INTEGER,
  still_unmatched INTEGER
) AS $$
DECLARE
  total_count INTEGER := 0;
  matched_count INTEGER := 0;
  unmatched_count INTEGER := 0;
  staging_record RECORD;
  mapping_result RECORD;
BEGIN
  -- Procesar cada item en staging sin match o con pending_assignment
  FOR staging_record IN
    SELECT id, vendor_email_raw, vendor_name_raw, movi_user_id, pending_assignment
    FROM commission_items_staging
    WHERE staging_session_id = p_session_id
      AND (pending_assignment = true OR movi_user_id IS NULL)
  LOOP
    total_count := total_count + 1;

    -- Buscar mapeo usando la función existente
    SELECT * INTO mapping_result
    FROM find_vendor_mapping(staging_record.vendor_email_raw, staging_record.vendor_name_raw);

    IF mapping_result.movi_user_id IS NOT NULL THEN
      -- Actualizar el item de staging con el match encontrado
      UPDATE commission_items_staging
      SET
        movi_user_id = mapping_result.movi_user_id,
        match_method = mapping_result.match_method,
        pending_assignment = false,
        assigned_at = NOW(),
        updated_at = NOW()
      WHERE id = staging_record.id;

      matched_count := matched_count + 1;
    ELSE
      -- Marcar como pendiente de asignación
      UPDATE commission_items_staging
      SET
        movi_user_id = NULL,
        match_method = 'none',
        pending_assignment = true,
        updated_at = NOW()
      WHERE id = staging_record.id;

      unmatched_count := unmatched_count + 1;
    END IF;
  END LOOP;

  -- Actualizar contadores en la sesión
  UPDATE commission_staging_sessions
  SET
    recognized_count = (
      SELECT COUNT(*)
      FROM commission_items_staging
      WHERE staging_session_id = p_session_id
        AND movi_user_id IS NOT NULL
        AND pending_assignment = false
    ),
    pending_assignment_count = (
      SELECT COUNT(*)
      FROM commission_items_staging
      WHERE staging_session_id = p_session_id
        AND pending_assignment = true
    ),
    updated_at = NOW()
  WHERE id = p_session_id;

  RETURN QUERY SELECT total_count, matched_count, unmatched_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION apply_vendor_mappings_to_staging_session IS 
'Aplica mapeos de vendedores automáticamente a items en staging. Usa find_vendor_mapping para buscar coincidencias por email o nombre.';

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION apply_vendor_mappings_to_staging_session(UUID) TO authenticated;
