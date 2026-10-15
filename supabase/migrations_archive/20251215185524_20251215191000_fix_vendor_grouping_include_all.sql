/*
  # Corrección de agrupación de vendedores no reconocidos

  1. Problema
    - La función get_unmatched_vendor_groups_by_name() solo mostraba vendedores con nombre
    - Ignoraba vendedores que solo tenían email o que no tenían datos

  2. Solución
    - Modificar la función para agrupar por vendor_key (que incluye nombre, email o unknown)
    - Agregar lógica para determinar si agrupar por nombre o email según disponibilidad
    - Asegurar que TODOS los documentos no reconocidos se muestren

  3. Cambios
    - Nueva función get_unmatched_vendor_groups_all() que agrupa por vendor_key
    - Mantener compatibilidad con la asignación por nombre cuando sea posible
*/

-- ============================================
-- FUNCIÓN MEJORADA PARA OBTENER TODOS LOS GRUPOS NO RECONOCIDOS
-- ============================================

CREATE OR REPLACE FUNCTION get_unmatched_vendor_groups_all(p_batch_id UUID)
RETURNS TABLE (
  vendor_key TEXT,
  vendor_name_norm TEXT,
  vendor_name_raw TEXT,
  vendor_email_norm TEXT,
  vendor_email_raw TEXT,
  document_count BIGINT,
  grouping_type TEXT,
  example_documents JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    doc.vendor_key,
    doc.vendor_name_norm,
    MODE() WITHIN GROUP (ORDER BY doc.vendor_name_raw) as vendor_name_raw,
    doc.vendor_email_norm,
    MODE() WITHIN GROUP (ORDER BY doc.vendor_email_raw) as vendor_email_raw,
    COUNT(doc.id) as document_count,
    CASE
      WHEN doc.vendor_name_norm IS NOT NULL AND doc.vendor_name_norm != '' THEN 'name'
      WHEN doc.vendor_email_norm IS NOT NULL AND doc.vendor_email_norm != '' THEN 'email'
      ELSE 'unknown'
    END as grouping_type,
    jsonb_agg(
      jsonb_build_object(
        'id', doc.id,
        'document_id', doc.document_id,
        'vendor_email_raw', doc.vendor_email_raw,
        'vendor_name_raw', doc.vendor_name_raw,
        'document_data', doc.document_data
      )
      ORDER BY doc.created_at DESC
    ) FILTER (WHERE doc.id IS NOT NULL) as example_documents
  FROM imported_documents doc
  WHERE doc.batch_id = p_batch_id
    AND doc.is_unmatched = true
  GROUP BY doc.vendor_key, doc.vendor_name_norm, doc.vendor_email_norm
  ORDER BY document_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCIÓN MEJORADA PARA ASIGNAR VENDEDOR (COMPATIBLE CON VENDOR_KEY)
-- ============================================

CREATE OR REPLACE FUNCTION assign_vendor_by_key(
  p_batch_id UUID,
  p_vendor_key TEXT,
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
  v_vendor_name_norm TEXT;
  v_vendor_email_norm TEXT;
  v_source_type TEXT;
  v_source_value TEXT;
BEGIN
  -- Validar que el batch y el grupo existan
  IF NOT EXISTS (
    SELECT 1 FROM imported_documents
    WHERE batch_id = p_batch_id
      AND vendor_key = p_vendor_key
      AND is_unmatched = true
  ) THEN
    RETURN QUERY SELECT 0, false, 'No se encontraron documentos para este grupo'::TEXT;
    RETURN;
  END IF;

  -- Obtener ejemplo de datos del vendedor
  SELECT vendor_name_raw, vendor_email_raw, vendor_name_norm, vendor_email_norm
  INTO v_vendor_name_raw, v_vendor_email_raw, v_vendor_name_norm, v_vendor_email_norm
  FROM imported_documents
  WHERE batch_id = p_batch_id
    AND vendor_key = p_vendor_key
    AND is_unmatched = true
  LIMIT 1;

  -- Actualizar todos los documentos del grupo en el batch
  UPDATE imported_documents
  SET
    movi_user_id = p_movi_user_id,
    match_method = 'manual',
    is_unmatched = false,
    updated_at = now()
  WHERE batch_id = p_batch_id
    AND vendor_key = p_vendor_key
    AND is_unmatched = true;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Guardar mapeo si se solicita
  IF p_save_mapping THEN
    -- Determinar qué tipo de mapeo guardar (prioridad: nombre > email)
    IF v_vendor_name_norm IS NOT NULL AND v_vendor_name_norm != '' THEN
      v_source_type := 'name';
      v_source_value := v_vendor_name_norm;
    ELSIF v_vendor_email_norm IS NOT NULL AND v_vendor_email_norm != '' THEN
      v_source_type := 'email';
      v_source_value := v_vendor_email_norm;
    ELSE
      v_source_type := NULL;
      v_source_value := NULL;
    END IF;

    IF v_source_type IS NOT NULL THEN
      -- Insertar o actualizar mapeo
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
        v_source_type,
        v_source_value,
        p_movi_user_id,
        'active',
        COALESCE(p_created_by, auth.uid()),
        COALESCE(p_created_by, auth.uid()),
        jsonb_build_array(
          jsonb_build_object(
            'name', v_vendor_name_raw,
            'email', v_vendor_email_raw
          )
        )
      )
      ON CONFLICT (source_type, source_value)
      DO UPDATE SET
        movi_user_id = p_movi_user_id,
        updated_by = COALESCE(p_created_by, auth.uid()),
        updated_at = now(),
        status = 'active',
        source_raw_examples = CASE
          WHEN NOT vendor_mappings.source_raw_examples @> jsonb_build_array(jsonb_build_object('name', v_vendor_name_raw))
          THEN vendor_mappings.source_raw_examples || jsonb_build_object('name', v_vendor_name_raw, 'email', v_vendor_email_raw)
          ELSE vendor_mappings.source_raw_examples
        END;

      v_mapping_saved := true;
    END IF;
  END IF;

  -- Actualizar contadores del batch
  PERFORM update_batch_counters(p_batch_id);

  RETURN QUERY SELECT v_updated_count, v_mapping_saved, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN PARA OBTENER DOCUMENTOS POR VENDOR_KEY
-- ============================================

CREATE OR REPLACE FUNCTION get_documents_by_vendor_key(
  p_batch_id UUID,
  p_vendor_key TEXT,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  document_id TEXT,
  vendor_name_raw TEXT,
  vendor_email_raw TEXT,
  document_data JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    doc.id,
    doc.document_id,
    doc.vendor_name_raw,
    doc.vendor_email_raw,
    doc.document_data,
    doc.created_at
  FROM imported_documents doc
  WHERE doc.batch_id = p_batch_id
    AND doc.vendor_key = p_vendor_key
    AND doc.is_unmatched = true
  ORDER BY doc.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;
