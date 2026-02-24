/*
  # Fix: Corregir Campo tipo_seguro → tipo_ramo

  1. Changes
    - Corregir tipo_seguro → tipo_ramo en función de recálculo
*/

CREATE OR REPLACE FUNCTION recalculate_batch_fiscal_values(
  p_batch_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_usuario_id UUID;
  v_regimen_fiscal TEXT;
  v_commission_vida NUMERIC;
  v_commission_sinvida NUMERIC;
  v_commission_total NUMERIC;
  v_retencion_contable NUMERIC;
  v_costo_dispersion NUMERIC;
  v_iva NUMERIC;
  v_ret_isr NUMERIC;
  v_ret_iva NUMERIC;
  v_total_neto NUMERIC;
  v_desglose JSONB;
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

  -- Obtener régimen fiscal del usuario
  SELECT 
    CASE 
      WHEN cfr.id IS NOT NULL THEN cfr.name
      ELSE 'HONORARIOS'
    END INTO v_regimen_fiscal
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE u.id = v_usuario_id;

  -- Calcular totales base (VIDA vs DAÑOS/ACCIDENTES)
  SELECT 
    COALESCE(SUM(CASE WHEN tipo_ramo = 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_ramo != 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(commission_neta), 0)
  INTO v_commission_vida, v_commission_sinvida, v_commission_total
  FROM commission_details
  WHERE batch_id = p_batch_id;

  -- Calcular desglose fiscal según régimen
  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    SELECT * INTO v_desglose FROM calcular_desglose_asimilados(
      v_commission_vida,
      v_commission_sinvida
    );
  ELSIF v_regimen_fiscal = 'RESICO' THEN
    SELECT * INTO v_desglose FROM calcular_desglose_resico(
      v_commission_vida,
      v_commission_sinvida
    );
  ELSE -- HONORARIOS
    SELECT * INTO v_desglose FROM calcular_desglose_honorarios(
      v_commission_vida,
      v_commission_sinvida
    );
  END IF;

  -- Extraer valores del desglose
  v_retencion_contable := COALESCE((v_desglose->>'retContable')::NUMERIC, 0);
  v_costo_dispersion := COALESCE((v_desglose->>'costoDispersion')::NUMERIC, 0);
  v_iva := COALESCE((v_desglose->>'iva')::NUMERIC, 0);
  v_ret_isr := COALESCE((v_desglose->>'retIsr')::NUMERIC, 0);
  v_ret_iva := COALESCE((v_desglose->>'retIva')::NUMERIC, 0);
  v_total_neto := COALESCE((v_desglose->>'totalAPagar')::NUMERIC, 0);

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
    fiscal_desglose_json = v_desglose,
    calculated_at = NOW(),
    tax_version = '2026-v1',
    updated_at = NOW()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'usuario_id', v_usuario_id,
    'regimen_fiscal', v_regimen_fiscal,
    'total_neto', v_total_neto
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
