/*
  # Permitir conversión parcial de batches
  
  1. Cambios
    - Modificar la función validate_batch_for_conversion para que:
      - Documentos sin asignar generen WARNING en lugar de ERROR
      - Se pueda convertir aunque haya documentos sin asignar
      - Los documentos sin asignar simplemente se omiten de la conversión
  
  2. Comportamiento
    - Permite conversión si al menos 1 documento tiene vendedor asignado
    - Muestra advertencia sobre documentos que no se convertirán
*/

CREATE OR REPLACE FUNCTION validate_batch_for_conversion(batch_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  total_docs int;
  matched_docs int;
  unmatched_docs int;
  missing_dates int;
  missing_dates_matched int;
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
  
  -- Contar documentos totales
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
  
  -- Contar documentos asignados y sin asignar
  SELECT COUNT(*) INTO matched_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND movi_user_id IS NOT NULL 
    AND is_unmatched = false;
  
  SELECT COUNT(*) INTO unmatched_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND (movi_user_id IS NULL OR is_unmatched = true);
  
  -- Si hay documentos sin asignar, generar WARNING (no error)
  IF unmatched_docs > 0 THEN
    result := jsonb_set(
      result, 
      '{warnings}', 
      result->'warnings' || jsonb_build_array(
        unmatched_docs || ' documentos sin asignar no se incluirán en la conversión'
      )
    );
  END IF;
  
  -- Si no hay ningún documento asignado, entonces sí es un error
  IF matched_docs = 0 THEN
    result := jsonb_set(
      result, 
      '{errors}', 
      result->'errors' || '["No hay documentos con vendedor asignado para convertir"]'::jsonb
    );
    RETURN result;
  END IF;
  
  -- Verificar documentos sin fecha SOLO en documentos asignados
  SELECT COUNT(*) INTO missing_dates_matched
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND movi_user_id IS NOT NULL 
    AND is_unmatched = false
    AND (document_data->>'fecha_pago' IS NULL OR document_data->>'fecha_pago' = '');
  
  IF missing_dates_matched > 0 THEN
    result := jsonb_set(
      result, 
      '{errors}', 
      result->'errors' || jsonb_build_array(
        'Falta fecha en ' || missing_dates_matched || ' documentos asignados. No es posible agrupar por semana.'
      )
    );
  END IF;
  
  -- Si no hay errores, obtener información de semanas (solo documentos asignados)
  IF jsonb_array_length(result->'errors') = 0 THEN
    result := jsonb_set(result, '{can_convert}', 'true'::jsonb);
    
    -- Obtener resumen de semanas solo con documentos asignados
    SELECT jsonb_agg(week_data)
    INTO weeks_info
    FROM (
      SELECT 
        EXTRACT(WEEK FROM (document_data->>'fecha_pago')::date) as week_number,
        DATE_TRUNC('week', (document_data->>'fecha_pago')::date)::date as week_start,
        (DATE_TRUNC('week', (document_data->>'fecha_pago')::date) + INTERVAL '6 days')::date as week_end,
        COUNT(*) as document_count,
        COUNT(DISTINCT movi_user_id) as agent_count
      FROM imported_documents
      WHERE batch_id = batch_id_param
        AND movi_user_id IS NOT NULL
        AND is_unmatched = false
      GROUP BY week_number, week_start, week_end
      ORDER BY week_start
    ) as week_data;
    
    result := jsonb_set(
      result, 
      '{summary}', 
      jsonb_build_object(
        'total_documents', matched_docs,
        'unmatched_documents', unmatched_docs,
        'total_agents', (
          SELECT COUNT(DISTINCT movi_user_id) 
          FROM imported_documents 
          WHERE batch_id = batch_id_param
            AND movi_user_id IS NOT NULL
            AND is_unmatched = false
        ),
        'weeks', COALESCE(weeks_info, '[]'::jsonb)
      )
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_batch_for_conversion IS 'Valida un batch para conversión a comisiones. Permite conversión parcial omitiendo documentos sin asignar.';
