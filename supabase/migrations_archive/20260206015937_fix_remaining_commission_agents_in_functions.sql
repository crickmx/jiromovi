/*
  # Corregir funciones que todavía referencian commission_agents

  1. Problema
    - calculate_batch_fiscal_desglose usa commission_agents
    - get_matched_vendors_by_name usa commission_agents
    
  2. Solución
    - Actualizar ambas funciones para usar usuarios en lugar de commission_agents
*/

-- =============================================
-- FUNCIÓN 1: calculate_batch_fiscal_desglose
-- =============================================

CREATE OR REPLACE FUNCTION calculate_batch_fiscal_desglose(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_usuario_id uuid;
  v_regime_name text;
  v_result jsonb;
BEGIN
  -- 1. Obtener el usuario del lote (asumiendo que todos los detalles son del mismo usuario)
  SELECT DISTINCT usuario_id INTO v_usuario_id
  FROM commission_details
  WHERE batch_id = p_batch_id
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No se encontró usuario para este lote',
      'batch_id', p_batch_id
    );
  END IF;

  -- 2. Obtener régimen fiscal del usuario
  SELECT cfr.name INTO v_regime_name
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE u.id = v_usuario_id;

  -- 3. Calcular según régimen
  IF UPPER(v_regime_name) = 'HONORARIOS' THEN
    v_result := calculate_honorarios_fiscal_desglose(p_batch_id);
  ELSIF UPPER(v_regime_name) = 'ASIMILADOS' THEN
    v_result := calculate_asimilados_fiscal_desglose(p_batch_id);
  ELSIF UPPER(v_regime_name) = 'RESICO' THEN
    v_result := calculate_resico_fiscal_desglose(p_batch_id);
  ELSE
    -- Si no hay régimen definido, usar HONORARIOS por defecto
    v_result := calculate_honorarios_fiscal_desglose(p_batch_id);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCIÓN 2: get_matched_vendors_by_name
-- =============================================

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

    -- Agrupar por usuario_id
    RETURN QUERY
    SELECT
      cd.usuario_id as movi_user_id,
      u.nombre_completo as user_name,
      COALESCE(u.email_laboral, u.email_personal) as user_email,
      COUNT(cd.id) as document_count,
      ARRAY(
        SELECT DISTINCT cd2.vendor_name
        FROM commission_details cd2
        WHERE cd2.batch_id = ANY(v_commission_batch_ids)
          AND cd2.usuario_id = cd.usuario_id
          AND cd2.vendor_name IS NOT NULL
          AND cd2.vendor_name != ''
      ) as vendor_names_detected,
      ARRAY[]::TEXT[] as vendor_emails_detected, -- No hay emails en commission_details
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'poliza', cd4.poliza,
            'aseguradora', cd4.aseguradora,
            'vendor_name', cd4.vendor_name,
            'commission_bruta', cd4.commission_bruta
          )
        )
        FROM (
          SELECT cd4.poliza, cd4.aseguradora, cd4.vendor_name, cd4.commission_bruta, cd4.created_at
          FROM commission_details cd4
          WHERE cd4.batch_id = ANY(v_commission_batch_ids)
            AND cd4.usuario_id = cd.usuario_id
          ORDER BY cd4.created_at DESC
          LIMIT 10
        ) sample_docs
      ) as example_documents
    FROM commission_details cd
    LEFT JOIN usuarios u ON u.id = cd.usuario_id
    WHERE cd.batch_id = ANY(v_commission_batch_ids)
      AND cd.usuario_id IS NOT NULL
      AND cd.pending_assignment = false
    GROUP BY cd.usuario_id, u.nombre_completo, u.email_laboral, u.email_personal
    ORDER BY document_count DESC;

  ELSE
    -- CASO 2: El lote AÚN NO ha sido convertido a comisiones
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
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', doc4.id,
            'poliza', doc4.poliza,
            'aseguradora', doc4.aseguradora,
            'vendor_name_raw', doc4.vendor_name_raw,
            'vendor_email_raw', doc4.vendor_email_raw,
            'importe_comision', doc4.importe_comision
          )
        )
        FROM (
          SELECT doc4.*
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_batch_fiscal_desglose IS 'Calcula desglose fiscal del lote - usa usuarios en lugar de commission_agents';
COMMENT ON FUNCTION get_matched_vendors_by_name IS 'Obtiene vendedores reconocidos por nombre - usa usuarios en lugar de commission_agents';
