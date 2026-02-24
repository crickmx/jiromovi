/*
  # Fix: Usar Función Existente para Recálculo Fiscal

  1. Changes
    - Simplificar recalculate_batch_fiscal_values para usar calculate_batch_fiscal_desglose
*/

CREATE OR REPLACE FUNCTION recalculate_batch_fiscal_values(
  p_batch_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_usuario_id UUID;
  v_desglose JSONB;
  v_regimen_fiscal TEXT;
BEGIN
  -- Obtener el usuario del lote (debe ser único)
  SELECT DISTINCT usuario_id INTO v_usuario_id
  FROM commission_details
  WHERE batch_id = p_batch_id
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró usuario para el lote %', p_batch_id;
  END IF;

  -- Verificar que todos los details tengan el mismo usuario
  IF EXISTS (
    SELECT 1 FROM commission_details
    WHERE batch_id = p_batch_id
      AND usuario_id != v_usuario_id
  ) THEN
    RAISE EXCEPTION 'El lote % tiene múltiples usuarios. Debe separarse primero.', p_batch_id;
  END IF;

  -- Usar la función existente para calcular
  v_desglose := calculate_batch_fiscal_desglose(p_batch_id);

  -- Obtener régimen fiscal del batch
  SELECT regimen_fiscal INTO v_regimen_fiscal
  FROM commission_batches
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'usuario_id', v_usuario_id,
    'regimen_fiscal', v_regimen_fiscal,
    'desglose', v_desglose
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_batch_fiscal_values IS 
'Recalcula los valores fiscales de un lote usando la función existente calculate_batch_fiscal_desglose.';
