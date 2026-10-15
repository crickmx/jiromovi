/*
  # Mejoras para Agrupación de Documentos por Nombre de Vendedor

  1. Cambios
    - Agregar vendor_name_norm y vendor_email_norm a imported_documents
    - Crear función para obtener grupos de vendedores no reconocidos SOLO por nombre
    - Crear función para asignar vendedor por grupo de nombre con mapeo persistente
    - Agregar índices para optimizar consultas de agrupación

  2. Funcionalidad
    - Los documentos se agrupan por vendor_name_norm en la UI de "Vendedores no reconocidos"
    - El admin asigna usuario MOVI a todo un grupo de nombre
    - Se guarda mapeo persistente para futuros lotes
    - Auto-reconocimiento en futuras importaciones
*/

-- ============================================
-- AGREGAR CAMPOS NORMALIZADOS
-- ============================================

DO $$
BEGIN
  -- Agregar vendor_name_norm
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imported_documents' AND column_name = 'vendor_name_norm'
  ) THEN
    ALTER TABLE imported_documents ADD COLUMN vendor_name_norm TEXT;
  END IF;

  -- Agregar vendor_email_norm
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imported_documents' AND column_name = 'vendor_email_norm'
  ) THEN
    ALTER TABLE imported_documents ADD COLUMN vendor_email_norm TEXT;
  END IF;
END $$;

-- Crear índices para agrupación por nombre
CREATE INDEX IF NOT EXISTS idx_imported_documents_vendor_name_norm
  ON imported_documents(vendor_name_norm)
  WHERE vendor_name_norm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imported_documents_batch_unmatched
  ON imported_documents(batch_id, is_unmatched)
  WHERE is_unmatched = true;

-- ============================================
-- FUNCIÓN PARA OBTENER GRUPOS DE VENDEDORES NO RECONOCIDOS POR NOMBRE
-- ============================================

CREATE OR REPLACE FUNCTION get_unmatched_vendor_groups_by_name(p_batch_id UUID)
RETURNS TABLE (
  vendor_name_norm TEXT,
  vendor_name_raw TEXT,
  document_count BIGINT,
  emails_detected TEXT[],
  example_documents JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    doc.vendor_name_norm,
    -- Tomar el vendor_name_raw más común del grupo
    MODE() WITHIN GROUP (ORDER BY doc.vendor_name_raw) as vendor_name_raw,
    COUNT(doc.id) as document_count,
    -- Recopilar emails únicos detectados en el grupo
    ARRAY_AGG(DISTINCT doc.vendor_email_raw) FILTER (WHERE doc.vendor_email_raw IS NOT NULL AND doc.vendor_email_raw != '') as emails_detected,
    -- Ejemplos de documentos (máximo 10)
    jsonb_agg(
      jsonb_build_object(
        'id', doc.id,
        'document_id', doc.document_id,
        'vendor_email_raw', doc.vendor_email_raw,
        'document_data', doc.document_data
      )
      ORDER BY doc.created_at DESC
    ) FILTER (WHERE doc.id IS NOT NULL) as example_documents
  FROM imported_documents doc
  WHERE doc.batch_id = p_batch_id
    AND doc.is_unmatched = true
    AND doc.vendor_name_norm IS NOT NULL
    AND doc.vendor_name_norm != ''
  GROUP BY doc.vendor_name_norm
  ORDER BY document_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCIÓN PARA ASIGNAR VENDEDOR POR GRUPO DE NOMBRE
-- ============================================

CREATE OR REPLACE FUNCTION assign_vendor_group_by_name(
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
BEGIN
  -- Validar que el batch y el grupo existan
  IF NOT EXISTS (
    SELECT 1 FROM imported_documents
    WHERE batch_id = p_batch_id
      AND vendor_name_norm = p_vendor_name_norm
      AND is_unmatched = true
  ) THEN
    RETURN QUERY SELECT 0, false, 'No se encontraron documentos para este grupo'::TEXT;
    RETURN;
  END IF;

  -- Obtener ejemplo de vendor_name_raw y vendor_email_raw
  SELECT vendor_name_raw, vendor_email_raw
  INTO v_vendor_name_raw, v_vendor_email_raw
  FROM imported_documents
  WHERE batch_id = p_batch_id
    AND vendor_name_norm = p_vendor_name_norm
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
    AND vendor_name_norm = p_vendor_name_norm
    AND is_unmatched = true;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Guardar mapeo si se solicita
  IF p_save_mapping AND p_vendor_name_norm IS NOT NULL THEN
    -- Insertar o actualizar mapeo por nombre
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

  -- Actualizar contadores del batch
  PERFORM update_batch_counters(p_batch_id);

  RETURN QUERY SELECT v_updated_count, v_mapping_saved, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN PARA OBTENER DOCUMENTOS DE UN GRUPO
-- ============================================

CREATE OR REPLACE FUNCTION get_documents_by_vendor_group(
  p_batch_id UUID,
  p_vendor_name_norm TEXT,
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
    AND doc.vendor_name_norm = p_vendor_name_norm
    AND doc.is_unmatched = true
  ORDER BY doc.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- ACTUALIZAR DATOS EXISTENTES
-- ============================================

-- Llenar los campos normalizados para datos existentes
UPDATE imported_documents
SET
  vendor_name_norm = normalize_name(vendor_name_raw),
  vendor_email_norm = normalize_email(vendor_email_raw)
WHERE vendor_name_norm IS NULL OR vendor_email_norm IS NULL;