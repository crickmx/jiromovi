/*
  # Corregir función de vendedores reconocidos para lotes convertidos

  1. Cambios
    - Actualizar get_matched_vendors_by_name() para buscar en commission_details cuando el lote ha sido convertido
    - Mostrar agentes de commission_agents con su información completa
    - Mantener compatibilidad con lotes no convertidos (imported_documents)
*/

-- ============================================
-- FUNCIÓN MEJORADA: VENDEDORES RECONOCIDOS
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
DECLARE
  v_is_converted BOOLEAN;
  v_commission_batch_ids UUID[];
BEGIN
  -- Verificar si el lote ha sido convertido a comisiones
  SELECT
    EXISTS (
      SELECT 1 FROM commission_batches cb
      WHERE cb.source_import_batch_id = p_batch_id
    )
  INTO v_is_converted;

  IF v_is_converted THEN
    -- CASO 1: El lote ha sido convertido a comisiones
    -- Buscar en commission_batches y commission_details

    -- Obtener IDs de los lotes de comisiones generados
    SELECT ARRAY_AGG(cb.id)
    INTO v_commission_batch_ids
    FROM commission_batches cb
    WHERE cb.source_import_batch_id = p_batch_id;

    RETURN QUERY
    SELECT
      cd.agent_id as movi_user_id,
      COALESCE(ca.name, u.nombre_completo) as user_name,
      COALESCE(ca.email, u.email_laboral, u.email_personal) as user_email,
      COUNT(cd.id) as document_count,
      ARRAY(
        SELECT DISTINCT cd2.vendor_name_raw
        FROM commission_details cd2
        WHERE cd2.batch_id = ANY(v_commission_batch_ids)
          AND cd2.agent_id = cd.agent_id
          AND cd2.vendor_name_raw IS NOT NULL
          AND cd2.vendor_name_raw != ''
        ORDER BY cd2.vendor_name_raw
      ) as vendor_names_detected,
      ARRAY(
        SELECT DISTINCT cd3.agent_email
        FROM commission_details cd3
        WHERE cd3.batch_id = ANY(v_commission_batch_ids)
          AND cd3.agent_id = cd.agent_id
          AND cd3.agent_email IS NOT NULL
          AND cd3.agent_email != ''
        ORDER BY cd3.agent_email
      ) as vendor_emails_detected,
      (
        SELECT jsonb_agg(doc_sample)
        FROM (
          SELECT jsonb_build_object(
            'id', cd4.id,
            'poliza', cd4.poliza,
            'ramo', cd4.ramo,
            'aseguradora', cd4.aseguradora,
            'agent_email', cd4.agent_email,
            'vendor_name_raw', cd4.vendor_name_raw,
            'importe', cd4.importe,
            'commission_neta', cd4.commission_neta
          ) as doc_sample
          FROM commission_details cd4
          WHERE cd4.batch_id = ANY(v_commission_batch_ids)
            AND cd4.agent_id = cd.agent_id
          ORDER BY cd4.created_at DESC
          LIMIT 10
        ) sample_docs
      ) as example_documents
    FROM commission_details cd
    LEFT JOIN commission_agents ca ON ca.id = cd.agent_id
    LEFT JOIN usuarios u ON u.id = cd.agent_id
    WHERE cd.batch_id = ANY(v_commission_batch_ids)
      AND cd.agent_id IS NOT NULL
      AND cd.pending_assignment = false
    GROUP BY cd.agent_id, ca.name, ca.email, u.nombre_completo, u.email_laboral, u.email_personal
    ORDER BY document_count DESC;

  ELSE
    -- CASO 2: El lote NO ha sido convertido (comportamiento original)
    -- Buscar en imported_documents

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

  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_matched_vendors_by_name IS 'Agrupa documentos reconocidos por usuario asignado. Soporta tanto lotes importados como lotes convertidos a comisiones.';