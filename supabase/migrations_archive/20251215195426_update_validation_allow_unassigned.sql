/*
  # Actualizar validación para permitir conversión con documentos sin asignar
  
  1. Modificar validate_batch_for_conversion
    - NO bloquear por documentos sin usuario
    - Cambiar errores por advertencias
    - Incluir conteo de pendientes en summary
  
  2. Modificar calculate_batch_status_v2
    - Permitir ready_to_convert aunque haya sin asignar
*/

-- Actualizar función de validación para NO bloquear por usuarios sin asignar
CREATE OR REPLACE FUNCTION validate_batch_for_conversion(batch_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  total_docs int;
  unmatched_docs int;
  missing_dates int;
  weeks_info jsonb;
BEGIN
  -- Inicializar resultado
  result := jsonb_build_object(
    'can_convert', false,
    'errors', '[]'::jsonb,
    'warnings', '[]'::jsonb,
    'summary', '{}'::jsonb
  );
  
  -- Verificar si ya fue convertido
  IF EXISTS (
    SELECT 1 FROM document_import_batches 
    WHERE id = batch_id_param AND status = 'converted'
  ) THEN
    result := jsonb_set(
      result, 
      '{errors}', 
      result->'errors' || '["El batch ya fue convertido anteriormente"]'::jsonb
    );
    RETURN result;
  END IF;
  
  -- Contar documentos
  SELECT COUNT(*) INTO total_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param;
  
  IF total_docs = 0 THEN
    result := jsonb_set(
      result, 
      '{errors}', 
      result->'errors' || '["No hay documentos en este batch"]'::jsonb
    );
    RETURN result;
  END IF;
  
  -- Verificar documentos sin asignar (AHORA ES ADVERTENCIA, NO ERROR)
  SELECT COUNT(*) INTO unmatched_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND (movi_user_id IS NULL OR is_unmatched = true);
  
  IF unmatched_docs > 0 THEN
    result := jsonb_set(
      result, 
      '{warnings}', 
      result->'warnings' || jsonb_build_array(
        'Hay ' || unmatched_docs || ' documentos sin usuario asignado. Podrás asignarlos dentro del lote después de convertir.'
      )
    );
  END IF;
  
  -- Verificar documentos sin fecha (ESTO SÍ ES ERROR)
  SELECT COUNT(*) INTO missing_dates
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND (document_data->>'fecha_pago' IS NULL OR document_data->>'fecha_pago' = '');
  
  IF missing_dates > 0 THEN
    result := jsonb_set(
      result, 
      '{errors}', 
      result->'errors' || jsonb_build_array(
        'Falta fecha en ' || missing_dates || ' documentos. No es posible agrupar por semana.'
      )
    );
  END IF;
  
  -- Si no hay errores (solo fechas bloquean), obtener información de semanas
  IF jsonb_array_length(result->'errors') = 0 THEN
    result := jsonb_set(result, '{can_convert}', 'true'::jsonb);
    
    -- Obtener resumen de semanas (INCLUIR TODOS LOS DOCS, con y sin usuario)
    SELECT jsonb_agg(week_data)
    INTO weeks_info
    FROM (
      SELECT 
        EXTRACT(WEEK FROM (document_data->>'fecha_pago')::date) as week_number,
        DATE_TRUNC('week', (document_data->>'fecha_pago')::date)::date as week_start,
        (DATE_TRUNC('week', (document_data->>'fecha_pago')::date) + INTERVAL '6 days')::date as week_end,
        COUNT(*) as document_count,
        COUNT(DISTINCT movi_user_id) FILTER (WHERE movi_user_id IS NOT NULL) as agent_count,
        COUNT(*) FILTER (WHERE movi_user_id IS NULL OR is_unmatched = true) as unassigned_count
      FROM imported_documents
      WHERE batch_id = batch_id_param
      GROUP BY week_number, week_start, week_end
      ORDER BY week_start
    ) as week_data;
    
    result := jsonb_set(
      result, 
      '{summary}', 
      jsonb_build_object(
        'total_documents', total_docs,
        'unmatched_documents', unmatched_docs,
        'assigned_documents', total_docs - unmatched_docs,
        'total_agents', (
          SELECT COUNT(DISTINCT movi_user_id) 
          FROM imported_documents 
          WHERE batch_id = batch_id_param
          AND movi_user_id IS NOT NULL
        ),
        'weeks', COALESCE(weeks_info, '[]'::jsonb)
      )
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Actualizar función de estado para permitir ready_to_convert aunque haya sin asignar
CREATE OR REPLACE FUNCTION calculate_batch_status_v2(batch_id_param uuid)
RETURNS text AS $$
DECLARE
  total_docs int;
  unmatched_docs int;
  missing_dates int;
  current_status text;
BEGIN
  -- Obtener el estado actual
  SELECT status INTO current_status 
  FROM document_import_batches 
  WHERE id = batch_id_param;
  
  -- Si ya fue convertido, mantener ese estado
  IF current_status = 'converted' THEN
    RETURN 'converted';
  END IF;
  
  -- Contar documentos
  SELECT COUNT(*) INTO total_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param;
  
  -- Si no hay documentos, uploaded
  IF total_docs = 0 THEN
    RETURN 'uploaded';
  END IF;
  
  -- Contar documentos sin asignar (YA NO BLOQUEA)
  SELECT COUNT(*) INTO unmatched_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND (movi_user_id IS NULL OR is_unmatched = true);
  
  -- Verificar que todos tengan fecha
  SELECT COUNT(*) INTO missing_dates
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND (document_data->>'fecha_pago' IS NULL OR document_data->>'fecha_pago' = '');
  
  -- Si faltan fechas, error
  IF missing_dates > 0 THEN
    RETURN 'error';
  END IF;
  
  -- Si tiene documentos y todos tienen fecha válida, LISTO PARA CONVERTIR
  -- (incluso si hay sin asignar)
  IF unmatched_docs > 0 THEN
    RETURN 'ready_to_convert'; -- Cambio: antes era 'needs_mapping'
  END IF;
  
  -- Si todo está perfecto
  RETURN 'ready_to_convert';
END;
$$ LANGUAGE plpgsql;

-- Actualizar estados de batches existentes
UPDATE document_import_batches 
SET status = calculate_batch_status_v2(id)
WHERE status IN ('needs_mapping', 'uploaded', 'error');
