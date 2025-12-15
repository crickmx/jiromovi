/*
  # Agrupar vendedores por nombre con emails detectados

  1. Problema actual
    - La función get_unmatched_vendor_groups_all() agrupa por vendor_key
    - Esto crea grupos separados por email vs nombre
    - No muestra la relación entre nombres y emails del mismo vendedor

  2. Nueva solución
    - Agrupar SIEMPRE por vendor_name_norm (nombre normalizado)
    - Para cada grupo de nombre, recopilar todos los emails únicos detectados
    - Mostrar el nombre original más común (vendor_name_raw)
    - Grupo especial "Sin información" solo para registros sin nombre ni email

  3. Funciones nuevas
    - get_unmatched_vendors_by_name(): Agrupa por nombre con emails detectados
    - assign_vendor_by_name(): Asigna todos los docs del mismo nombre (ignora email)
*/

-- ============================================
-- FUNCIÓN: AGRUPAR VENDEDORES POR NOMBRE CON EMAILS
-- ============================================

CREATE OR REPLACE FUNCTION get_unmatched_vendors_by_name(p_batch_id UUID)
RETURNS TABLE (
  vendor_name_norm TEXT,
  vendor_display_name TEXT,
  document_count BIGINT,
  emails_detected TEXT[],
  unique_email_count INTEGER,
  example_documents JSONB
) AS $$
BEGIN
  RETURN QUERY
  -- Vendedores con nombre
  SELECT
    doc.vendor_name_norm as vendor_name_norm,
    MODE() WITHIN GROUP (ORDER BY doc.vendor_name_raw) as vendor_display_name,
    COUNT(doc.id) as document_count,
    ARRAY(
      SELECT DISTINCT unnest(ARRAY_AGG(doc2.vendor_email_raw))
      FROM imported_documents doc2
      WHERE doc2.batch_id = p_batch_id
        AND doc2.is_unmatched = true
        AND doc2.vendor_name_norm = doc.vendor_name_norm
        AND doc2.vendor_email_raw IS NOT NULL
        AND doc2.vendor_email_raw != ''
    ) as emails_detected,
    (
      SELECT COUNT(DISTINCT doc3.vendor_email_raw)
      FROM imported_documents doc3
      WHERE doc3.batch_id = p_batch_id
        AND doc3.is_unmatched = true
        AND doc3.vendor_name_norm = doc.vendor_name_norm
        AND doc3.vendor_email_raw IS NOT NULL
        AND doc3.vendor_email_raw != ''
    )::INTEGER as unique_email_count,
    (
      SELECT jsonb_agg(doc_sample)
      FROM (
        SELECT jsonb_build_object(
          'id', doc4.id,
          'document_id', doc4.document_id,
          'vendor_email_raw', doc4.vendor_email_raw,
          'vendor_name_raw', doc4.vendor_name_raw,
          'document_data', doc4.document_data
        ) as doc_sample
        FROM imported_documents doc4
        WHERE doc4.batch_id = p_batch_id
          AND doc4.is_unmatched = true
          AND doc4.vendor_name_norm = doc.vendor_name_norm
        ORDER BY doc4.created_at DESC
        LIMIT 10
      ) sample_docs
    ) as example_documents
  FROM imported_documents doc
  WHERE doc.batch_id = p_batch_id
    AND doc.is_unmatched = true
    AND doc.vendor_name_norm IS NOT NULL
    AND doc.vendor_name_norm != ''
  GROUP BY doc.vendor_name_norm
  
  UNION ALL
  
  -- Vendedores sin nombre (solo email)
  SELECT
    COALESCE(doc.vendor_email_norm, 'unknown') as vendor_name_norm,
    COALESCE(MODE() WITHIN GROUP (ORDER BY doc.vendor_email_raw), 'Solo email') as vendor_display_name,
    COUNT(doc.id) as document_count,
    ARRAY_AGG(DISTINCT doc.vendor_email_raw) FILTER (WHERE doc.vendor_email_raw IS NOT NULL AND doc.vendor_email_raw != '') as emails_detected,
    COUNT(DISTINCT doc.vendor_email_raw) FILTER (WHERE doc.vendor_email_raw IS NOT NULL AND doc.vendor_email_raw != '')::INTEGER as unique_email_count,
    (
      SELECT jsonb_agg(doc_sample)
      FROM (
        SELECT jsonb_build_object(
          'id', doc5.id,
          'document_id', doc5.document_id,
          'vendor_email_raw', doc5.vendor_email_raw,
          'vendor_name_raw', doc5.vendor_name_raw,
          'document_data', doc5.document_data
        ) as doc_sample
        FROM imported_documents doc5
        WHERE doc5.batch_id = p_batch_id
          AND doc5.is_unmatched = true
          AND (doc5.vendor_name_norm IS NULL OR doc5.vendor_name_norm = '')
          AND doc5.vendor_email_norm = doc.vendor_email_norm
        ORDER BY doc5.created_at DESC
        LIMIT 10
      ) sample_docs
    ) as example_documents
  FROM imported_documents doc
  WHERE doc.batch_id = p_batch_id
    AND doc.is_unmatched = true
    AND (doc.vendor_name_norm IS NULL OR doc.vendor_name_norm = '')
    AND doc.vendor_email_norm IS NOT NULL
    AND doc.vendor_email_norm != ''
  GROUP BY doc.vendor_email_norm
  
  UNION ALL
  
  -- Documentos sin vendedor (ni nombre ni email)
  SELECT
    'unknown' as vendor_name_norm,
    'Sin información de vendedor' as vendor_display_name,
    COUNT(doc.id) as document_count,
    ARRAY[]::TEXT[] as emails_detected,
    0 as unique_email_count,
    (
      SELECT jsonb_agg(doc_sample)
      FROM (
        SELECT jsonb_build_object(
          'id', doc6.id,
          'document_id', doc6.document_id,
          'vendor_email_raw', doc6.vendor_email_raw,
          'vendor_name_raw', doc6.vendor_name_raw,
          'document_data', doc6.document_data
        ) as doc_sample
        FROM imported_documents doc6
        WHERE doc6.batch_id = p_batch_id
          AND doc6.is_unmatched = true
          AND (doc6.vendor_name_norm IS NULL OR doc6.vendor_name_norm = '')
          AND (doc6.vendor_email_norm IS NULL OR doc6.vendor_email_norm = '')
        ORDER BY doc6.created_at DESC
        LIMIT 10
      ) sample_docs
    ) as example_documents
  FROM imported_documents doc
  WHERE doc.batch_id = p_batch_id
    AND doc.is_unmatched = true
    AND (doc.vendor_name_norm IS NULL OR doc.vendor_name_norm = '')
    AND (doc.vendor_email_norm IS NULL OR doc.vendor_email_norm = '')
  HAVING COUNT(doc.id) > 0
  
  ORDER BY document_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_unmatched_vendors_by_name IS 'Agrupa vendedores no reconocidos por nombre, mostrando todos los emails detectados para cada vendedor';

-- ============================================
-- FUNCIÓN: ASIGNAR VENDEDOR POR NOMBRE
-- ============================================

CREATE OR REPLACE FUNCTION assign_vendor_by_name(
  p_batch_id UUID,
  p_vendor_name_norm TEXT,
  p_movi_user_id UUID,
  p_save_mapping BOOLEAN DEFAULT true,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  updated_count INTEGER,
  mapping_saved BOOLEAN,
  error TEXT
) AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_mapping_saved BOOLEAN := false;
  v_vendor_name_raw TEXT;
  v_vendor_email_raw TEXT;
  v_unique_emails TEXT[];
BEGIN
  -- Validar que existan documentos con este nombre
  IF NOT EXISTS (
    SELECT 1 FROM imported_documents
    WHERE batch_id = p_batch_id
      AND (
        (p_vendor_name_norm = 'unknown' AND (vendor_name_norm IS NULL OR vendor_name_norm = '') AND (vendor_email_norm IS NULL OR vendor_email_norm = ''))
        OR
        (p_vendor_name_norm != 'unknown' AND vendor_name_norm = p_vendor_name_norm)
        OR
        (p_vendor_name_norm NOT IN ('unknown') AND (vendor_name_norm IS NULL OR vendor_name_norm = '') AND vendor_email_norm = p_vendor_name_norm)
      )
      AND is_unmatched = true
  ) THEN
    RETURN QUERY SELECT 0, false, 'No se encontraron documentos para este vendedor'::TEXT;
    RETURN;
  END IF;

  -- Obtener ejemplo de datos
  SELECT vendor_name_raw, vendor_email_raw
  INTO v_vendor_name_raw, v_vendor_email_raw
  FROM imported_documents
  WHERE batch_id = p_batch_id
    AND (
      (p_vendor_name_norm = 'unknown' AND (vendor_name_norm IS NULL OR vendor_name_norm = '') AND (vendor_email_norm IS NULL OR vendor_email_norm = ''))
      OR
      (p_vendor_name_norm != 'unknown' AND vendor_name_norm = p_vendor_name_norm)
      OR
      (p_vendor_name_norm NOT IN ('unknown') AND (vendor_name_norm IS NULL OR vendor_name_norm = '') AND vendor_email_norm = p_vendor_name_norm)
    )
    AND is_unmatched = true
  LIMIT 1;

  -- Obtener todos los emails únicos del grupo
  SELECT ARRAY_AGG(DISTINCT vendor_email_raw)
  INTO v_unique_emails
  FROM imported_documents
  WHERE batch_id = p_batch_id
    AND (
      (p_vendor_name_norm = 'unknown' AND (vendor_name_norm IS NULL OR vendor_name_norm = '') AND (vendor_email_norm IS NULL OR vendor_email_norm = ''))
      OR
      (p_vendor_name_norm != 'unknown' AND vendor_name_norm = p_vendor_name_norm)
      OR
      (p_vendor_name_norm NOT IN ('unknown') AND (vendor_name_norm IS NULL OR vendor_name_norm = '') AND vendor_email_norm = p_vendor_name_norm)
    )
    AND is_unmatched = true
    AND vendor_email_raw IS NOT NULL
    AND vendor_email_raw != '';

  -- Actualizar todos los documentos del grupo
  UPDATE imported_documents
  SET
    movi_user_id = p_movi_user_id,
    match_method = 'manual',
    is_unmatched = false,
    updated_at = now()
  WHERE batch_id = p_batch_id
    AND (
      (p_vendor_name_norm = 'unknown' AND (vendor_name_norm IS NULL OR vendor_name_norm = '') AND (vendor_email_norm IS NULL OR vendor_email_norm = ''))
      OR
      (p_vendor_name_norm != 'unknown' AND vendor_name_norm = p_vendor_name_norm)
      OR
      (p_vendor_name_norm NOT IN ('unknown') AND (vendor_name_norm IS NULL OR vendor_name_norm = '') AND vendor_email_norm = p_vendor_name_norm)
    )
    AND is_unmatched = true;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Guardar mapeo si se solicita
  IF p_save_mapping AND p_vendor_name_norm != 'unknown' THEN
    -- Guardar mapeo por nombre si existe
    IF p_vendor_name_norm IS NOT NULL AND p_vendor_name_norm != '' AND LEFT(p_vendor_name_norm, 6) != 'email:' THEN
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
        p_vendor_name_norm,
        p_movi_user_id,
        'active',
        COALESCE(p_created_by, auth.uid()),
        COALESCE(p_created_by, auth.uid()),
        jsonb_build_array(
          jsonb_build_object(
            'name', v_vendor_name_raw,
            'emails', v_unique_emails
          )
        )
      )
      ON CONFLICT (source_type, source_value)
      DO UPDATE SET
        movi_user_id = p_movi_user_id,
        updated_by = COALESCE(p_created_by, auth.uid()),
        updated_at = now(),
        status = 'active';

      v_mapping_saved := true;
    END IF;

    -- Si hay emails, también guardar mapeos por cada email único
    IF v_unique_emails IS NOT NULL THEN
      DECLARE
        v_email TEXT;
      BEGIN
        FOREACH v_email IN ARRAY v_unique_emails
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
              p_movi_user_id,
              'active',
              COALESCE(p_created_by, auth.uid()),
              COALESCE(p_created_by, auth.uid()),
              jsonb_build_array(
                jsonb_build_object(
                  'name', v_vendor_name_raw,
                  'email', v_email
                )
              )
            )
            ON CONFLICT (source_type, source_value)
            DO UPDATE SET
              movi_user_id = p_movi_user_id,
              updated_by = COALESCE(p_created_by, auth.uid()),
              updated_at = now(),
              status = 'active';
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

COMMENT ON FUNCTION assign_vendor_by_name IS 'Asigna un usuario MOVI a todos los documentos de un vendedor por nombre, guardando mapeos para nombre y emails detectados';
