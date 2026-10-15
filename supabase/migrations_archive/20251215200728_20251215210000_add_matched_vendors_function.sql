/*
  # Agregar función para obtener vendedores reconocidos (matched)

  1. Nueva función
    - get_matched_vendors_by_name(): Agrupa documentos reconocidos por vendedor
    - Permite ver y corregir asignaciones existentes
*/

-- ============================================
-- FUNCIÓN: AGRUPAR VENDEDORES RECONOCIDOS POR USUARIO
-- ============================================

CREATE OR REPLACE FUNCTION get_matched_vendors_by_name(p_batch_id UUID)
RETURNS TABLE (
  movi_user_id UUID,
  user_name TEXT,
  user_email TEXT,
  document_count BIGINT,
  vendor_names_detected TEXT[],
  vendor_emails_detected TEXT[],
  example_documents JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    doc.movi_user_id,
    u.nombre_completo as user_name,
    COALESCE(u.email_laboral, u.email_personal) as user_email,
    COUNT(doc.id) as document_count,
    ARRAY(
      SELECT DISTINCT unnest(ARRAY_AGG(doc2.vendor_name_raw))
      FROM imported_documents doc2
      WHERE doc2.batch_id = p_batch_id
        AND doc2.is_unmatched = false
        AND doc2.movi_user_id = doc.movi_user_id
        AND doc2.vendor_name_raw IS NOT NULL
        AND doc2.vendor_name_raw != ''
    ) as vendor_names_detected,
    ARRAY(
      SELECT DISTINCT unnest(ARRAY_AGG(doc3.vendor_email_raw))
      FROM imported_documents doc3
      WHERE doc3.batch_id = p_batch_id
        AND doc3.is_unmatched = false
        AND doc3.movi_user_id = doc.movi_user_id
        AND doc3.vendor_email_raw IS NOT NULL
        AND doc3.vendor_email_raw != ''
    ) as vendor_emails_detected,
    (
      SELECT jsonb_agg(doc_sample)
      FROM (
        SELECT jsonb_build_object(
          'id', doc4.id,
          'document_id', doc4.document_id,
          'vendor_email_raw', doc4.vendor_email_raw,
          'vendor_name_raw', doc4.vendor_name_raw,
          'match_method', doc4.match_method,
          'document_data', doc4.document_data
        ) as doc_sample
        FROM imported_documents doc4
        WHERE doc4.batch_id = p_batch_id
          AND doc4.is_unmatched = false
          AND doc4.movi_user_id = doc.movi_user_id
        ORDER BY doc4.created_at DESC
        LIMIT 10
      ) sample_docs
    ) as example_documents
  FROM imported_documents doc
  LEFT JOIN usuarios u ON u.id = doc.movi_user_id
  WHERE doc.batch_id = p_batch_id
    AND doc.is_unmatched = false
    AND doc.movi_user_id IS NOT NULL
  GROUP BY doc.movi_user_id, u.nombre_completo, u.email_laboral, u.email_personal
  ORDER BY document_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_matched_vendors_by_name IS 'Agrupa documentos reconocidos por usuario asignado, mostrando nombres y emails de vendedores detectados';

-- ============================================
-- FUNCIÓN: REASIGNAR DOCUMENTOS DE UN USUARIO
-- ============================================

CREATE OR REPLACE FUNCTION reassign_user_documents(
  p_batch_id UUID,
  p_old_user_id UUID,
  p_new_user_id UUID,
  p_save_mapping BOOLEAN DEFAULT true
)
RETURNS TABLE (
  updated_count INTEGER,
  mapping_saved BOOLEAN,
  error TEXT
) AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_mapping_saved BOOLEAN := false;
  v_vendor_names TEXT[];
  v_vendor_emails TEXT[];
BEGIN
  -- Validar que existan documentos
  IF NOT EXISTS (
    SELECT 1 FROM imported_documents
    WHERE batch_id = p_batch_id
      AND movi_user_id = p_old_user_id
      AND is_unmatched = false
  ) THEN
    RETURN QUERY SELECT 0, false, 'No se encontraron documentos para este usuario'::TEXT;
    RETURN;
  END IF;

  -- Obtener todos los nombres y emails únicos
  SELECT
    ARRAY_AGG(DISTINCT vendor_name_raw),
    ARRAY_AGG(DISTINCT vendor_email_raw)
  INTO v_vendor_names, v_vendor_emails
  FROM imported_documents
  WHERE batch_id = p_batch_id
    AND movi_user_id = p_old_user_id
    AND is_unmatched = false
    AND (vendor_name_raw IS NOT NULL OR vendor_email_raw IS NOT NULL);

  -- Actualizar todos los documentos del usuario
  UPDATE imported_documents
  SET
    movi_user_id = p_new_user_id,
    match_method = 'manual',
    updated_at = now()
  WHERE batch_id = p_batch_id
    AND movi_user_id = p_old_user_id
    AND is_unmatched = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Guardar mapeos si se solicita
  IF p_save_mapping THEN
    -- Mapeos por nombre
    IF v_vendor_names IS NOT NULL THEN
      DECLARE
        v_name TEXT;
        v_name_norm TEXT;
      BEGIN
        FOREACH v_name IN ARRAY v_vendor_names
        LOOP
          IF v_name IS NOT NULL AND v_name != '' THEN
            -- Normalizar nombre (mismo proceso que en la importación)
            v_name_norm := LOWER(TRIM(REGEXP_REPLACE(v_name, '\s+', ' ', 'g')));

            INSERT INTO vendor_mappings (
              source_type,
              source_value,
              movi_user_id,
              status,
              created_by,
              updated_by,
              source_raw_examples
            )
            VALUES (
              'name',
              v_name_norm,
              p_new_user_id,
              'active',
              auth.uid(),
              auth.uid(),
              jsonb_build_array(jsonb_build_object('name', v_name))
            )
            ON CONFLICT (source_type, source_value)
            DO UPDATE SET
              movi_user_id = p_new_user_id,
              updated_by = auth.uid(),
              updated_at = now(),
              status = 'active';

            v_mapping_saved := true;
          END IF;
        END LOOP;
      END;
    END IF;

    -- Mapeos por email
    IF v_vendor_emails IS NOT NULL THEN
      DECLARE
        v_email TEXT;
      BEGIN
        FOREACH v_email IN ARRAY v_vendor_emails
        LOOP
          IF v_email IS NOT NULL AND v_email != '' THEN
            INSERT INTO vendor_mappings (
              source_type,
              source_value,
              movi_user_id,
              status,
              created_by,
              updated_by,
              source_raw_examples
            )
            VALUES (
              'email',
              LOWER(TRIM(v_email)),
              p_new_user_id,
              'active',
              auth.uid(),
              auth.uid(),
              jsonb_build_array(jsonb_build_object('email', v_email))
            )
            ON CONFLICT (source_type, source_value)
            DO UPDATE SET
              movi_user_id = p_new_user_id,
              updated_by = auth.uid(),
              updated_at = now(),
              status = 'active';

            v_mapping_saved := true;
          END IF;
        END LOOP;
      END;
    END IF;
  END IF;

  -- Actualizar contadores del batch
  PERFORM update_batch_counters(p_batch_id);

  RETURN QUERY SELECT v_updated_count, v_mapping_saved, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reassign_user_documents IS 'Reasigna todos los documentos de un usuario a otro, actualizando mapeos si se solicita';
