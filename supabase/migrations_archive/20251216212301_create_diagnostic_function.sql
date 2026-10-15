/*
  # Crear función de diagnóstico para imports

  1. Función
    - `get_import_diagnostic` - Obtiene diagnóstico completo cuando no hay filas insertables
    - Devuelve conteos por status, top reasons, y muestras de discard

  2. Propósito
    - Ayudar al admin a entender por qué un batch no tiene filas convertibles
    - Proveer ejemplos concretos de filas descartadas
*/

CREATE OR REPLACE FUNCTION get_import_diagnostic(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_total_count int;
  v_valid_count int;
  v_warning_count int;
  v_discard_count int;
  v_batch_info jsonb;
  v_top_reasons jsonb;
  v_samples jsonb;
BEGIN
  -- Obtener info del batch
  SELECT jsonb_build_object(
    'batch_id', id,
    'file_name', file_name,
    'sheet_name_used', sheet_name_used,
    'detected_format', detected_format,
    'imported_at', imported_at
  )
  INTO v_batch_info
  FROM document_import_batches
  WHERE id = p_batch_id;

  -- Conteos por status
  SELECT
    COUNT(*) FILTER (WHERE status = 'valid'),
    COUNT(*) FILTER (WHERE status = 'warning'),
    COUNT(*) FILTER (WHERE status = 'discard'),
    COUNT(*)
  INTO v_valid_count, v_warning_count, v_discard_count, v_total_count
  FROM document_import_items
  WHERE import_batch_id = p_batch_id;

  -- Top 10 razones de descarte
  SELECT jsonb_agg(reason_data ORDER BY count DESC)
  INTO v_top_reasons
  FROM (
    SELECT
      discard_reason as reason,
      COUNT(*) as count
    FROM document_import_items
    WHERE import_batch_id = p_batch_id
      AND status = 'discard'
      AND discard_reason IS NOT NULL
    GROUP BY discard_reason
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) AS reason_data;

  -- Muestras de filas descartadas (20 ejemplos)
  SELECT jsonb_agg(sample_data ORDER BY row_index)
  INTO v_samples
  FROM (
    SELECT
      row_index,
      vendor_name_raw,
      documento,
      ramo,
      importe_base,
      porcentaje,
      fpago,
      fpago_raw,
      aseguradora,
      discard_reason,
      warnings
    FROM document_import_items
    WHERE import_batch_id = p_batch_id
      AND status = 'discard'
    ORDER BY row_index
    LIMIT 20
  ) AS sample_data;

  -- Construir resultado
  v_result := jsonb_build_object(
    'batch_info', COALESCE(v_batch_info, '{}'::jsonb),
    'counts_by_status', jsonb_build_object(
      'total', v_total_count,
      'valid', v_valid_count,
      'warning', v_warning_count,
      'discard', v_discard_count
    ),
    'top_discard_reasons', COALESCE(v_top_reasons, '[]'::jsonb),
    'discard_samples', COALESCE(v_samples, '[]'::jsonb),
    'insertables', v_valid_count + v_warning_count
  );

  RETURN v_result;
END;
$$;
