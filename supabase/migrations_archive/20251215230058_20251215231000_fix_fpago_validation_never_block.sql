/*
  # FIX: FPago como única fuente de fecha - Nunca bloquear conversión

  1. Cambios
    - ALL_MISSING_DATE ahora es WARNING (no bloqueante)
    - Validación usa exclusivamente document_data->>'FPago'
    - Conversión SIEMPRE permitida, incluso sin fechas válidas
    - Se crea lote "Sin fecha" cuando FPago no existe

  2. Regla de Oro
    - FPago es la única fecha válida para comisiones
    - Si no existe o no parsea, el documento va a "Sin fecha"
    - Nunca se bloquea la conversión por fecha
*/

-- Actualizar función de validación detallada
CREATE OR REPLACE FUNCTION validate_batch_for_conversion_detailed(batch_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  total_docs int;
  matched_docs int;
  unmatched_docs int;
  missing_dates int;
  empty_vendor int;
  weeks_info jsonb;
  error_list jsonb := '[]'::jsonb;
  warning_list jsonb := '[]'::jsonb;
  can_convert boolean := true;
BEGIN
  -- Verificar si ya fue convertido
  IF EXISTS (
    SELECT 1 FROM document_import_batches
    WHERE id = batch_id_param AND converted_to_commissions = true
  ) THEN
    RETURN jsonb_build_object(
      'canConvert', false,
      'blockingErrorsCount', 1,
      'warningsCount', 0,
      'errors', jsonb_build_array(
        jsonb_build_object(
          'severity', 'blocking',
          'code', 'ALREADY_CONVERTED',
          'message', 'El batch ya fue convertido anteriormente',
          'count', 1,
          'affectedRows', '[]'::jsonb,
          'examples', '[]'::jsonb
        )
      )
    );
  END IF;

  -- Contar totales
  SELECT COUNT(*) INTO total_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param;

  IF total_docs = 0 THEN
    RETURN jsonb_build_object(
      'canConvert', false,
      'blockingErrorsCount', 1,
      'warningsCount', 0,
      'errors', jsonb_build_array(
        jsonb_build_object(
          'severity', 'blocking',
          'code', 'NO_DOCUMENTS',
          'message', 'No hay documentos en este batch',
          'count', 0,
          'affectedRows', '[]'::jsonb,
          'examples', '[]'::jsonb
        )
      )
    );
  END IF;

  -- Contar matched vs unmatched
  SELECT
    COUNT(*) FILTER (WHERE movi_user_id IS NOT NULL AND is_unmatched = false),
    COUNT(*) FILTER (WHERE movi_user_id IS NULL OR is_unmatched = true)
  INTO matched_docs, unmatched_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param;

  -- Contar documentos sin FPago válido (SOLO FPago es la fecha oficial)
  SELECT COUNT(*) INTO missing_dates
  FROM imported_documents
  WHERE batch_id = batch_id_param
    AND (
      document_data->>'FPago' IS NULL
      OR document_data->>'FPago' = ''
    );

  -- Contar vendedores vacíos
  SELECT COUNT(*) INTO empty_vendor
  FROM imported_documents
  WHERE batch_id = batch_id_param
    AND (vendor_name_raw IS NULL OR vendor_name_raw = '')
    AND (vendor_email_raw IS NULL OR vendor_email_raw = '');

  -- FPago faltante: SIEMPRE es WARNING, NUNCA bloqueante
  IF missing_dates = total_docs THEN
    -- Todos los documentos sin FPago
    warning_list := warning_list || jsonb_build_array(
      jsonb_build_object(
        'severity', 'warning',
        'code', 'ALL_MISSING_FPAGO',
        'message', format('FPago no está definido en ningún documento (%s total). Se creará un lote "Sin fecha" para gestionar después.', total_docs),
        'count', missing_dates,
        'affectedRows', (
          SELECT jsonb_agg(source_row_index)
          FROM imported_documents
          WHERE batch_id = batch_id_param
          LIMIT 20
        ),
        'examples', get_validation_error_details(batch_id_param, 'MISSING_DATE')
      )
    );
  ELSIF missing_dates > 0 THEN
    -- Algunos documentos sin FPago
    warning_list := warning_list || jsonb_build_array(
      jsonb_build_object(
        'severity', 'warning',
        'code', 'PARTIAL_MISSING_FPAGO',
        'message', format('Hay %s documentos sin FPago. Se incluirán en un lote especial "Sin fecha".', missing_dates),
        'count', missing_dates,
        'affectedRows', (
          SELECT jsonb_agg(source_row_index)
          FROM imported_documents
          WHERE batch_id = batch_id_param
            AND (document_data->>'FPago' IS NULL OR document_data->>'FPago' = '')
          LIMIT 20
        ),
        'examples', get_validation_error_details(batch_id_param, 'MISSING_DATE')
      )
    );
  END IF;

  -- Advertencia: documentos sin asignar (NO bloqueante)
  IF unmatched_docs > 0 THEN
    warning_list := warning_list || jsonb_build_array(
      jsonb_build_object(
        'severity', 'warning',
        'code', 'UNASSIGNED_USERS',
        'message', format('Hay %s documentos sin asignación de usuario. Se incluirán en los lotes con pending_assignment=true.', unmatched_docs),
        'count', unmatched_docs,
        'affectedRows', (
          SELECT jsonb_agg(source_row_index)
          FROM imported_documents
          WHERE batch_id = batch_id_param
            AND (movi_user_id IS NULL OR is_unmatched = true)
          LIMIT 20
        ),
        'examples', get_validation_error_details(batch_id_param, 'UNASSIGNED_USER')
      )
    );
  END IF;

  -- Advertencia: vendedores vacíos (NO bloqueante)
  IF empty_vendor > 0 THEN
    warning_list := warning_list || jsonb_build_array(
      jsonb_build_object(
        'severity', 'warning',
        'code', 'EMPTY_VENDOR',
        'message', format('Hay %s documentos sin información de vendedor. Se marcarán con vendor_key="unknown".', empty_vendor),
        'count', empty_vendor,
        'affectedRows', (
          SELECT jsonb_agg(source_row_index)
          FROM imported_documents
          WHERE batch_id = batch_id_param
            AND (vendor_name_raw IS NULL OR vendor_name_raw = '')
            AND (vendor_email_raw IS NULL OR vendor_email_raw = '')
          LIMIT 20
        ),
        'examples', get_validation_error_details(batch_id_param, 'EMPTY_VENDOR')
      )
    );
  END IF;

  -- Calcular información de semanas (excluyendo sin FPago)
  SELECT jsonb_agg(
    jsonb_build_object(
      'week_number', week_number,
      'week_start', week_start,
      'week_end', week_end,
      'document_count', document_count,
      'agent_count', agent_count
    )
  ) INTO weeks_info
  FROM (
    SELECT
      EXTRACT(WEEK FROM (document_data->>'FPago')::date) as week_number,
      date_trunc('week', (document_data->>'FPago')::date)::date as week_start,
      (date_trunc('week', (document_data->>'FPago')::date) + interval '6 days')::date as week_end,
      COUNT(*) as document_count,
      COUNT(DISTINCT movi_user_id) as agent_count
    FROM imported_documents
    WHERE batch_id = batch_id_param
      AND document_data->>'FPago' IS NOT NULL
      AND document_data->>'FPago' != ''
    GROUP BY week_number, week_start, week_end
    ORDER BY week_start
  ) as week_data;

  -- Construir resultado (SIEMPRE can_convert = true excepto si ya convertido o sin docs)
  RETURN jsonb_build_object(
    'canConvert', true,
    'blockingErrorsCount', 0,
    'warningsCount', jsonb_array_length(warning_list),
    'errors', warning_list,
    'summary', jsonb_build_object(
      'total_documents', total_docs,
      'matched_documents', matched_docs,
      'unmatched_documents', unmatched_docs,
      'missing_dates', missing_dates,
      'empty_vendor', empty_vendor,
      'total_agents', (
        SELECT COUNT(DISTINCT movi_user_id)
        FROM imported_documents
        WHERE batch_id = batch_id_param
          AND movi_user_id IS NOT NULL
      ),
      'weeks', COALESCE(weeks_info, '[]'::jsonb),
      'has_no_date_documents', missing_dates > 0
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_batch_for_conversion_detailed IS 'Valida batch usando SOLO FPago como fecha. NUNCA bloquea conversión por fecha. ALL_MISSING_FPAGO es WARNING.';
