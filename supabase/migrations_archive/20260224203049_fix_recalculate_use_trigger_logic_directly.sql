/*
  # Fix: Recalcular Usando Lógica del Trigger Directamente

  1. Changes
    - Copiar la lógica del trigger calculate_commission_with_fiscal_trigger
    - Aplicar directamente sin depender de otras funciones rotas
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
  v_iva NUMERIC := 0;
  v_ret_isr NUMERIC := 0;
  v_ret_iva NUMERIC := 0;
  v_retencion_contable NUMERIC := 0;
  v_costo_dispersion NUMERIC := 0;
  v_total_neto NUMERIC := 0;
  v_isr_vida NUMERIC := 0;
  v_isr_danios NUMERIC := 0;
  v_fiscal_regime RECORD;
BEGIN
  -- Obtener el usuario del lote (debe ser único)
  SELECT DISTINCT cd.usuario_id INTO v_usuario_id
  FROM commission_details cd
  WHERE cd.batch_id = p_batch_id
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
    COALESCE(cfr.name, 'HONORARIOS') as regime_name,
    cfr.iva_trasladado,
    cfr.iva_retenido,
    cfr.isr
  INTO v_fiscal_regime
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE u.id = v_usuario_id;

  v_regimen_fiscal := v_fiscal_regime.regime_name;

  -- Calcular totales por tipo de ramo
  SELECT 
    COALESCE(SUM(CASE WHEN tipo_ramo = 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_ramo != 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(commission_neta), 0)
  INTO v_commission_vida, v_commission_sinvida, v_commission_total
  FROM commission_details
  WHERE batch_id = p_batch_id;

  -- Calcular según régimen fiscal
  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- Asimilados: tiene retención contable y costo de dispersión
    v_retencion_contable := v_commission_vida * 0.01;
    v_costo_dispersion := (v_commission_vida - v_retencion_contable) * 0.09;
    v_isr_vida := ((v_commission_vida - v_retencion_contable - v_costo_dispersion) * v_fiscal_regime.isr) / 1.09;
    v_isr_danios := (v_commission_sinvida * v_fiscal_regime.isr) / 1.09;
    v_ret_isr := v_isr_vida + v_isr_danios;
    v_total_neto := v_commission_total - v_retencion_contable - v_costo_dispersion - v_ret_isr;
    
  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- RESICO
    v_iva := v_commission_total * v_fiscal_regime.iva_trasladado;
    v_ret_isr := (v_commission_total + v_iva) * v_fiscal_regime.isr;
    v_ret_iva := v_iva * v_fiscal_regime.iva_retenido;
    v_total_neto := v_commission_total + v_iva - v_ret_isr - v_ret_iva;
    
  ELSE -- HONORARIOS
    v_iva := v_commission_total * v_fiscal_regime.iva_trasladado;
    v_ret_isr := (v_commission_total + v_iva) * v_fiscal_regime.isr;
    v_ret_iva := v_iva * v_fiscal_regime.iva_retenido;
    v_total_neto := v_commission_total + v_iva - v_ret_isr - v_ret_iva;
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

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'usuario_id', v_usuario_id,
    'regimen_fiscal', v_regimen_fiscal,
    'total_neto', v_total_neto
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_batch_fiscal_values IS 
'Recalcula los valores fiscales de un lote de comisiones según el régimen fiscal del usuario.';
