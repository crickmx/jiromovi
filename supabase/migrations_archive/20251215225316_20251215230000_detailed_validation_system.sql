/*
  # Sistema de Validación Detallada para Conversión de Batches

  1. Cambios
    - Función de validación detallada que devuelve errores específicos con conteos
    - Separa validaciones bloqueantes vs no bloqueantes
    - Permite conversión con pendientes de asignación
    - Permite conversión parcial con documentos sin fecha

  2. Comportamiento
    - NO bloqueantes: movi_user_id null, vendor_name vacío
    - Bloqueantes: 100% sin fecha válida, batch ya convertido
    - Si algunas filas sin fecha: crear lote especial "Sin fecha"
*/

-- Función para obtener filas con errores específicos
CREATE OR REPLACE FUNCTION get_validation_error_details(
  batch_id_param uuid,
  error_type text
)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  IF error_type = 'MISSING_DATE' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'row_index', source_row_index,
        'poliza', COALESCE((document_data->>'poliza'), (document_data->>'policy'), document_id),
        'vendor_name', COALESCE(vendor_name_raw, 'Sin vendedor'),
        'vendor_email', COALESCE(vendor_email_raw, 'Sin email'),
        'document_id', document_id
      )
    ) INTO result
    FROM imported_documents
    WHERE batch_id = batch_id_param
      AND (
        document_data->>'fecha_fpago' IS NULL
        OR document_data->>'fecha_fpago' = ''
        OR document_data->>'fecha' IS NULL
        OR document_data->>'fecha' = ''
      )
    LIMIT 100;

  ELSIF error_type = 'UNASSIGNED_USER' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'row_index', source_row_index,
        'poliza', COALESCE((document_data->>'poliza'), (document_data->>'policy'), document_id),
        'vendor_name', COALESCE(vendor_name_raw, 'Sin vendedor'),
        'vendor_email', COALESCE(vendor_email_raw, 'Sin email'),
        'document_id', document_id
      )
    ) INTO result
    FROM imported_documents
    WHERE batch_id = batch_id_param
      AND (movi_user_id IS NULL OR is_unmatched = true)
    LIMIT 100;

  ELSIF error_type = 'EMPTY_VENDOR' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'row_index', source_row_index,
        'poliza', COALESCE((document_data->>'poliza'), (document_data->>'policy'), document_id),
        'document_id', document_id
      )
    ) INTO result
    FROM imported_documents
    WHERE batch_id = batch_id_param
      AND (vendor_name_raw IS NULL OR vendor_name_raw = '')
      AND (vendor_email_raw IS NULL OR vendor_email_raw = '')
    LIMIT 100;
  END IF;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función de validación detallada
CREATE OR REPLACE FUNCTION validate_batch_for_conversion_detailed(batch_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  total_docs int;
  matched_docs int;
  unmatched_docs int;
  missing_dates int;
  empty_vendor int;
  all_missing_dates boolean;
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

  -- Contar documentos sin fecha (en cualquier columna)
  SELECT COUNT(*) INTO missing_dates
  FROM imported_documents
  WHERE batch_id = batch_id_param
    AND (
      (document_data->>'fecha_fpago' IS NULL OR document_data->>'fecha_fpago' = '')
      AND (document_data->>'fecha' IS NULL OR document_data->>'fecha' = '')
      AND (document_data->>'date' IS NULL OR document_data->>'date' = '')
    );

  -- Contar vendedores vacíos
  SELECT COUNT(*) INTO empty_vendor
  FROM imported_documents
  WHERE batch_id = batch_id_param
    AND (vendor_name_raw IS NULL OR vendor_name_raw = '')
    AND (vendor_email_raw IS NULL OR vendor_email_raw = '');

  -- Validación bloqueante: 100% sin fecha válida
  all_missing_dates := (missing_dates = total_docs);

  IF all_missing_dates THEN
    error_list := error_list || jsonb_build_array(
      jsonb_build_object(
        'severity', 'blocking',
        'code', 'ALL_MISSING_DATE',
        'message', 'Todos los documentos carecen de fecha válida. No se puede crear ningún lote.',
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
    can_convert := false;
  ELSIF missing_dates > 0 THEN
    -- Advertencia: algunas sin fecha
    warning_list := warning_list || jsonb_build_array(
      jsonb_build_object(
        'severity', 'warning',
        'code', 'PARTIAL_MISSING_DATE',
        'message', format('Hay %s documentos sin fecha. Se crearán en un lote especial "Sin fecha" para revisión.', missing_dates),
        'count', missing_dates,
        'affectedRows', (
          SELECT jsonb_agg(source_row_index)
          FROM imported_documents
          WHERE batch_id = batch_id_param
            AND (
              (document_data->>'fecha_fpago' IS NULL OR document_data->>'fecha_fpago' = '')
              AND (document_data->>'fecha' IS NULL OR document_data->>'fecha' = '')
            )
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

  -- Calcular información de semanas (excluyendo sin fecha)
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
      EXTRACT(WEEK FROM (document_data->>'fecha_fpago')::date) as week_number,
      date_trunc('week', (document_data->>'fecha_fpago')::date)::date as week_start,
      (date_trunc('week', (document_data->>'fecha_fpago')::date) + interval '6 days')::date as week_end,
      COUNT(*) as document_count,
      COUNT(DISTINCT movi_user_id) as agent_count
    FROM imported_documents
    WHERE batch_id = batch_id_param
      AND document_data->>'fecha_fpago' IS NOT NULL
      AND document_data->>'fecha_fpago' != ''
    GROUP BY week_number, week_start, week_end
    ORDER BY week_start
  ) as week_data;

  -- Construir resultado
  RETURN jsonb_build_object(
    'canConvert', can_convert,
    'blockingErrorsCount', jsonb_array_length(error_list),
    'warningsCount', jsonb_array_length(warning_list),
    'errors', error_list || warning_list,
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

COMMENT ON FUNCTION validate_batch_for_conversion_detailed IS 'Valida batch con errores detallados, conteos y ejemplos de filas afectadas';
COMMENT ON FUNCTION get_validation_error_details IS 'Obtiene detalles de filas afectadas por un tipo específico de error de validación';
