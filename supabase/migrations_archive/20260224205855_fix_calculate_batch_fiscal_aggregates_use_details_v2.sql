/*
  # Fix: calculate_batch_fiscal_aggregates debe sumar desde commission_details

  1. Problema
    - La función antigua intenta calcular valores fiscales
    - Usa columnas que ya no existen (importe_pago)
    - No es compatible con lotes de múltiples regímenes

  2. Solución
    - Simplemente sumar los valores ya calculados en commission_details
    - El trigger calculate_detail_fiscal_values_trigger ya hace los cálculos
    - Esta función solo agrega y persiste en el batch
*/

-- Eliminar la función antigua
DROP FUNCTION IF EXISTS calculate_batch_fiscal_aggregates(uuid);

-- Crear la nueva versión
CREATE OR REPLACE FUNCTION calculate_batch_fiscal_aggregates(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_regimen_count integer;
  v_regimen_fiscal text;
  v_commission_vida numeric := 0;
  v_commission_sinvida numeric := 0;
  v_commission_total numeric := 0;
  v_retencion_contable numeric := 0;
  v_costo_dispersion numeric := 0;
  v_iva numeric := 0;
  v_ret_isr numeric := 0;
  v_ret_iva numeric := 0;
  v_total_neto numeric := 0;
  v_detail_count integer := 0;
  v_calculated_details integer := 0;
BEGIN
  -- Verificar que el batch existe
  IF NOT EXISTS (SELECT 1 FROM commission_batches WHERE id = p_batch_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El lote no existe'
    );
  END IF;

  -- Contar details y cuántos tienen valores calculados
  SELECT 
    COUNT(*),
    COUNT(calculated_at)
  INTO v_detail_count, v_calculated_details
  FROM commission_details
  WHERE batch_id = p_batch_id;

  IF v_detail_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El lote no tiene pólizas asociadas'
    );
  END IF;

  -- Si no todos están calculados, forzar recálculo
  IF v_calculated_details < v_detail_count THEN
    UPDATE commission_details
    SET commission_neta = commission_neta
    WHERE batch_id = p_batch_id
      AND calculated_at IS NULL;
  END IF;

  -- Sumar todos los valores desde commission_details
  SELECT 
    COALESCE(SUM(CASE WHEN tipo_ramo = 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_ramo != 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(commission_neta), 0),
    COALESCE(SUM(retencion_contable), 0),
    COALESCE(SUM(costo_dispersion), 0),
    COALESCE(SUM(iva), 0),
    COALESCE(SUM(ret_isr), 0),
    COALESCE(SUM(ret_iva), 0),
    COALESCE(SUM(total_neto), 0)
  INTO 
    v_commission_vida,
    v_commission_sinvida,
    v_commission_total,
    v_retencion_contable,
    v_costo_dispersion,
    v_iva,
    v_ret_isr,
    v_ret_iva,
    v_total_neto
  FROM commission_details
  WHERE batch_id = p_batch_id;

  -- Determinar régimen fiscal del lote
  SELECT COUNT(DISTINCT regimen_fiscal)
  INTO v_regimen_count
  FROM commission_details
  WHERE batch_id = p_batch_id
    AND regimen_fiscal IS NOT NULL;

  IF v_regimen_count = 1 THEN
    -- Un solo régimen
    SELECT DISTINCT regimen_fiscal
    INTO v_regimen_fiscal
    FROM commission_details
    WHERE batch_id = p_batch_id
    LIMIT 1;
  ELSE
    -- Múltiples regímenes
    v_regimen_fiscal := NULL;
  END IF;

  -- Actualizar el batch
  UPDATE commission_batches
  SET
    regimen_fiscal = v_regimen_fiscal,
    commission_vida = v_commission_vida,
    commission_sinvida = v_commission_sinvida,
    commission_total = v_commission_total,
    retencion_contable = v_retencion_contable,
    costo_dispersion = v_costo_dispersion,
    iva = v_iva,
    ret_isr = v_ret_isr,
    ret_iva = v_ret_iva,
    total_neto = v_total_neto,
    calculated_at = NOW(),
    tax_version = '2026-v1',
    updated_at = NOW()
  WHERE id = p_batch_id;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'regimen_fiscal', v_regimen_fiscal,
    'regimen_count', v_regimen_count,
    'commission_vida', v_commission_vida,
    'commission_sinvida', v_commission_sinvida,
    'commission_total', v_commission_total,
    'retencion_contable', v_retencion_contable,
    'costo_dispersion', v_costo_dispersion,
    'iva', v_iva,
    'ret_isr', v_ret_isr,
    'ret_iva', v_ret_iva,
    'total_neto', v_total_neto,
    'detail_count', v_detail_count,
    'calculated_details', v_calculated_details,
    'tax_version', '2026-v1'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_batch_fiscal_aggregates IS 
'Suma valores fiscales ya calculados en commission_details y los persiste en commission_batches. 
Soporta lotes con múltiples regímenes fiscales (regimen_fiscal = NULL si hay varios).';
