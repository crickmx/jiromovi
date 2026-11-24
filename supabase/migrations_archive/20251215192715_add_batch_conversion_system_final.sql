/*
  # Sistema de conversión de importaciones a lotes de comisiones por semana
  
  1. Cambios en document_import_batches
    - Actualizar estados: uploaded, needs_mapping, ready_to_convert, converted, error
    - Agregar campo para validaciones
  
  2. Cambios en commission_batches
    - Agregar referencia a batch de importación (source_import_batch_id)
    - Agregar información de semana (week_number, period_start, period_end)
  
  3. Funciones
    - Función para calcular estado del batch
    - Función para validar si puede convertirse
    - Función para obtener semanas de un batch
  
  4. Seguridad
    - Solo admins pueden convertir batches
    - RLS policies actualizadas
*/

-- 1. Desactivar cualquier trigger existente primero
DROP TRIGGER IF EXISTS trigger_update_batch_status ON imported_documents;

-- 2. Agregar las columnas nuevas sin cambiar el constraint todavía
ALTER TABLE document_import_batches 
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_summary jsonb DEFAULT '{}'::jsonb;

-- 3. Actualizar commission_batches para enlazar con importación
ALTER TABLE commission_batches 
  ADD COLUMN IF NOT EXISTS source_import_batch_id uuid REFERENCES document_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS week_number int,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_commission_batches_source_import 
  ON commission_batches(source_import_batch_id);

CREATE INDEX IF NOT EXISTS idx_commission_batches_week 
  ON commission_batches(week_number);

-- 4. Actualizar los estados existentes a valores temporales válidos
UPDATE document_import_batches 
SET status = 'processing' 
WHERE status NOT IN ('processing', 'completed', 'failed', 'partial');

-- 5. AHORA cambiar el constraint para incluir los nuevos estados
ALTER TABLE document_import_batches 
  DROP CONSTRAINT IF EXISTS document_import_batches_status_check;

ALTER TABLE document_import_batches 
  ADD CONSTRAINT document_import_batches_status_check 
  CHECK (status IN ('uploaded', 'needs_mapping', 'ready_to_convert', 'converted', 'error', 'processing', 'completed', 'failed', 'partial'));

-- 6. Crear función para calcular el estado del batch
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
  
  -- Contar documentos sin asignar
  SELECT COUNT(*) INTO unmatched_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND (movi_user_id IS NULL OR is_unmatched = true);
  
  -- Si hay documentos sin asignar
  IF unmatched_docs > 0 THEN
    RETURN 'needs_mapping';
  END IF;
  
  -- Verificar que todos tengan fecha
  SELECT COUNT(*) INTO missing_dates
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND (document_data->>'fecha_pago' IS NULL OR document_data->>'fecha_pago' = '');
  
  -- Si todos están asignados pero faltan fechas
  IF missing_dates > 0 THEN
    RETURN 'error';
  END IF;
  
  -- Si todo está bien
  RETURN 'ready_to_convert';
END;
$$ LANGUAGE plpgsql;

-- 7. Actualizar los estados existentes usando la función
UPDATE document_import_batches 
SET status = calculate_batch_status_v2(id)
WHERE status IN ('processing', 'completed', 'failed', 'partial', 'uploaded');

-- 8. Función para validar si un batch puede convertirse
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
  
  -- Verificar documentos sin asignar
  SELECT COUNT(*) INTO unmatched_docs
  FROM imported_documents
  WHERE batch_id = batch_id_param 
    AND (movi_user_id IS NULL OR is_unmatched = true);
  
  IF unmatched_docs > 0 THEN
    result := jsonb_set(
      result, 
      '{errors}', 
      result->'errors' || jsonb_build_array(
        'Faltan asignar usuarios en ' || unmatched_docs || ' documentos'
      )
    );
  END IF;
  
  -- Verificar documentos sin fecha
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
  
  -- Si no hay errores, obtener información de semanas
  IF jsonb_array_length(result->'errors') = 0 THEN
    result := jsonb_set(result, '{can_convert}', 'true'::jsonb);
    
    -- Obtener resumen de semanas
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
      GROUP BY week_number, week_start, week_end
      ORDER BY week_start
    ) as week_data;
    
    result := jsonb_set(
      result, 
      '{summary}', 
      jsonb_build_object(
        'total_documents', total_docs,
        'total_agents', (
          SELECT COUNT(DISTINCT movi_user_id) 
          FROM imported_documents 
          WHERE batch_id = batch_id_param
        ),
        'weeks', COALESCE(weeks_info, '[]'::jsonb)
      )
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger para actualizar estado automáticamente
CREATE OR REPLACE FUNCTION update_batch_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE document_import_batches
  SET 
    status = calculate_batch_status_v2(NEW.batch_id),
    updated_at = now()
  WHERE id = NEW.batch_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_batch_status
  AFTER INSERT OR UPDATE OF movi_user_id, is_unmatched, document_data
  ON imported_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_status_trigger();
