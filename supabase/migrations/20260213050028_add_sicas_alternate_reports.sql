/*
  # Agregar Soporte para Reportes Alternativos en SICAS

  1. Cambios
    - Agregar columna alternate_report_codes a sicas_config
    - Agregar columna current_report_code para tracking
    - Agregar función para obtener siguiente reporte alternativo

  2. Notas
    - Permite fallback automático si un reporte falla
    - Mantiene historial de qué reporte funcionó
*/

-- Agregar columnas para reportes alternativos
ALTER TABLE sicas_config
ADD COLUMN IF NOT EXISTS alternate_report_codes TEXT[] DEFAULT ARRAY['H03117', 'H03115', 'H03100', 'H03101', 'H03102'],
ADD COLUMN IF NOT EXISTS current_report_code TEXT DEFAULT 'H03117',
ADD COLUMN IF NOT EXISTS last_successful_report TEXT,
ADD COLUMN IF NOT EXISTS report_test_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN sicas_config.alternate_report_codes IS 'Lista de códigos de reporte alternativos para intentar si el primero falla';
COMMENT ON COLUMN sicas_config.current_report_code IS 'Código de reporte actualmente en uso';
COMMENT ON COLUMN sicas_config.last_successful_report IS 'Último código de reporte que funcionó correctamente';
COMMENT ON COLUMN sicas_config.report_test_history IS 'Historial de pruebas de reportes';

-- Función para obtener siguiente reporte alternativo
CREATE OR REPLACE FUNCTION get_next_alternate_report()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_current_index INT;
  v_next_code TEXT;
BEGIN
  -- Obtener configuración actual
  SELECT * INTO v_config
  FROM sicas_config
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'H03117';
  END IF;

  -- Buscar índice del código actual
  SELECT idx - 1 INTO v_current_index
  FROM unnest(v_config.alternate_report_codes) WITH ORDINALITY AS t(code, idx)
  WHERE code = v_config.current_report_code;

  -- Si no se encontró o es el último, volver al primero
  IF v_current_index IS NULL OR v_current_index >= array_length(v_config.alternate_report_codes, 1) THEN
    v_next_code := v_config.alternate_report_codes[1];
  ELSE
    v_next_code := v_config.alternate_report_codes[v_current_index + 2];
  END IF;

  RETURN v_next_code;
END;
$$;

COMMENT ON FUNCTION get_next_alternate_report IS 'Obtiene el siguiente código de reporte alternativo de la lista';

-- Función para marcar reporte como exitoso
CREATE OR REPLACE FUNCTION mark_report_successful(p_report_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sicas_config
  SET
    last_successful_report = p_report_code,
    current_report_code = p_report_code,
    report_test_history = report_test_history || jsonb_build_object(
      'report_code', p_report_code,
      'status', 'success',
      'tested_at', now()
    )
  WHERE id = (SELECT id FROM sicas_config LIMIT 1);
END;
$$;

COMMENT ON FUNCTION mark_report_successful IS 'Marca un código de reporte como exitoso y lo establece como actual';

-- Función para marcar reporte como fallido y cambiar al siguiente
CREATE OR REPLACE FUNCTION mark_report_failed(p_report_code TEXT, p_error_message TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_code TEXT;
BEGIN
  -- Registrar el fallo
  UPDATE sicas_config
  SET
    report_test_history = report_test_history || jsonb_build_object(
      'report_code', p_report_code,
      'status', 'failed',
      'error_message', p_error_message,
      'tested_at', now()
    )
  WHERE id = (SELECT id FROM sicas_config LIMIT 1);

  -- Obtener siguiente código
  v_next_code := get_next_alternate_report();

  -- Actualizar código actual
  UPDATE sicas_config
  SET current_report_code = v_next_code
  WHERE id = (SELECT id FROM sicas_config LIMIT 1);

  RETURN v_next_code;
END;
$$;

COMMENT ON FUNCTION mark_report_failed IS 'Marca un código de reporte como fallido y devuelve el siguiente a intentar';
