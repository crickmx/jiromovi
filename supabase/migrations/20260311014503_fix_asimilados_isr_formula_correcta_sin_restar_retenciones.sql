/*
  # Fix: Fórmula correcta ISR para ASIMILADOS

  1. Problema
    - La fórmula actual resta las retenciones antes de calcular ISR
    - Fórmula incorrecta: ((Comisión - Retención) / 1.09) × 0.10
    
  2. Fórmula CORRECTA (según imagen del usuario)
    - ISR Daños: (Comisión_neta / 1.09) × 0.10
    - ISR Vida: (Comisión_neta / 1.16) × 0.10
    - NO se restan las retenciones antes de dividir
    
  3. Validación con ejemplo de la imagen
    - Comisión Neta: $9,039.75
    - Costo Dispersión: $813.58 (9% de $9,039.75)
    - ISR: ($9,039.75 / 1.09) × 0.10 = $829.33 ✅
    - Total: $9,039.75 - $813.58 - $829.33 = $7,396.84
*/

-- Eliminar trigger anterior
DROP TRIGGER IF EXISTS calculate_detail_fiscal_values_trigger ON commission_details;

-- Recrear función con la fórmula CORRECTA
CREATE OR REPLACE FUNCTION calculate_detail_fiscal_values()
RETURNS TRIGGER AS $$
DECLARE
  v_regimen_fiscal TEXT;
  v_commission_neta NUMERIC;
  v_tipo_ramo TEXT;
  v_iva NUMERIC := 0;
  v_ret_isr NUMERIC := 0;
  v_ret_iva NUMERIC := 0;
  v_retencion_contable NUMERIC := 0;
  v_costo_dispersion NUMERIC := 0;
  v_total_neto NUMERIC := 0;
BEGIN
  -- Obtener régimen fiscal del usuario
  SELECT UPPER(COALESCE(cfr.name, 'HONORARIOS'))
  INTO v_regimen_fiscal
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE u.id = NEW.usuario_id;

  IF v_regimen_fiscal IS NULL THEN
    v_regimen_fiscal := 'HONORARIOS';
  END IF;

  -- Calcular tipo_ramo desde el campo ramo
  IF UPPER(NEW.ramo) = 'VIDA' THEN
    v_tipo_ramo := 'VIDA';
  ELSE
    v_tipo_ramo := 'DAÑOS';
  END IF;

  v_commission_neta := COALESCE(NEW.commission_neta, 0);

  -- Calcular según régimen fiscal
  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- ============================================
    -- ASIMILADOS: FÓRMULA CORRECTA OFICIAL
    -- ============================================
    -- 1. Calcular retenciones
    IF v_tipo_ramo = 'VIDA' THEN
      v_retencion_contable := v_commission_neta * 0.16;
      v_costo_dispersion := 0;
      -- ISR Vida: (Comisión / 1.16) × 0.10
      -- NO restar retención contable antes de dividir
      v_ret_isr := (v_commission_neta / 1.16) * 0.10;
    ELSE
      v_retencion_contable := 0;
      v_costo_dispersion := v_commission_neta * 0.09;
      -- ISR Daños: (Comisión / 1.09) × 0.10
      -- NO restar costo dispersión antes de dividir
      v_ret_isr := (v_commission_neta / 1.09) * 0.10;
    END IF;
    
    v_iva := 0;
    v_ret_iva := 0;
    v_total_neto := v_commission_neta - v_retencion_contable - v_costo_dispersion - v_ret_isr;
    
  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- RESICO: 1.25% ISR, mismo IVA que HONORARIOS
    IF v_tipo_ramo != 'VIDA' THEN
      v_iva := v_commission_neta * 0.16;
      v_ret_iva := (v_commission_neta * 16) / 150; -- 10.667%
    END IF;
    v_ret_isr := v_commission_neta * 0.0125;
    v_total_neto := v_commission_neta + v_iva - v_ret_isr - v_ret_iva;
    
  ELSE -- HONORARIOS
    -- HONORARIOS: 10% ISR
    IF v_tipo_ramo != 'VIDA' THEN
      v_iva := v_commission_neta * 0.16;
      v_ret_iva := (v_commission_neta * 16) / 150; -- 10.667%
    END IF;
    v_ret_isr := v_commission_neta * 0.10;
    v_total_neto := v_commission_neta + v_iva - v_ret_isr - v_ret_iva;
  END IF;

  -- Redondear todos los valores a 2 decimales
  NEW.regimen_fiscal := v_regimen_fiscal;
  NEW.tipo_ramo := v_tipo_ramo;
  NEW.iva := ROUND(v_iva, 2);
  NEW.ret_isr := ROUND(v_ret_isr, 2);
  NEW.ret_iva := ROUND(v_ret_iva, 2);
  NEW.retencion_contable := ROUND(v_retencion_contable, 2);
  NEW.costo_dispersion := ROUND(v_costo_dispersion, 2);
  NEW.total_neto := ROUND(v_total_neto, 2);
  NEW.calculated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger
CREATE TRIGGER calculate_detail_fiscal_values_trigger
  BEFORE INSERT OR UPDATE OF commission_neta, usuario_id, ramo
  ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION calculate_detail_fiscal_values();

-- Actualizar función de agregación para ASIMILADOS
CREATE OR REPLACE FUNCTION calculate_batch_asimilados_fiscal(
  p_batch_id UUID,
  p_usuario_id UUID
)
RETURNS TABLE(
  vida NUMERIC,
  danios NUMERIC,
  ret_contable NUMERIC,
  costo_dispersion NUMERIC,
  isr_vida NUMERIC,
  isr_danios NUMERIC,
  isr_total NUMERIC,
  total_a_pagar NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total_vida NUMERIC := 0;
  v_total_danios NUMERIC := 0;
  v_ret_contable NUMERIC;
  v_costo_dispersion NUMERIC;
  v_isr_vida NUMERIC;
  v_isr_danios NUMERIC;
  v_isr_total NUMERIC;
  v_total_pagar NUMERIC;
BEGIN
  -- Sumar totales por tipo de ramo
  SELECT 
    COALESCE(SUM(CASE WHEN tipo_ramo = 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_ramo = 'DAÑOS' THEN commission_neta ELSE 0 END), 0)
  INTO v_total_vida, v_total_danios
  FROM commission_details
  WHERE batch_id = p_batch_id
    AND usuario_id = p_usuario_id
    AND regimen_fiscal = 'ASIMILADOS';

  -- Calcular retenciones
  v_ret_contable := ROUND(v_total_vida * 0.16, 2);
  v_costo_dispersion := ROUND(v_total_danios * 0.09, 2);

  -- Calcular ISR (SIN restar retenciones antes de dividir)
  -- ISR Vida: (Comisión / 1.16) × 0.10
  v_isr_vida := ROUND((v_total_vida / 1.16) * 0.10, 2);
  
  -- ISR Daños: (Comisión / 1.09) × 0.10
  v_isr_danios := ROUND((v_total_danios / 1.09) * 0.10, 2);

  -- ISR Total
  v_isr_total := v_isr_vida + v_isr_danios;

  -- Total a pagar
  v_total_pagar := ROUND((v_total_vida + v_total_danios) - v_ret_contable - v_costo_dispersion - v_isr_total, 2);

  RETURN QUERY SELECT
    v_total_vida,
    v_total_danios,
    v_ret_contable,
    v_costo_dispersion,
    v_isr_vida,
    v_isr_danios,
    v_isr_total,
    v_total_pagar;
END;
$$;

-- Recalcular todos los registros de ASIMILADOS
UPDATE commission_details
SET commission_neta = commission_neta
WHERE regimen_fiscal = 'ASIMILADOS';

COMMENT ON FUNCTION calculate_detail_fiscal_values IS
'Calcula automáticamente los valores fiscales de cada commission_detail según el régimen del usuario.
ASIMILADOS: Ret. Contable 16% (Vida), Costo Dispersión 9% (Daños), ISR = (Comisión/1.16)×0.10 (Vida) o (Comisión/1.09)×0.10 (Daños)
HONORARIOS: 10% ISR, 16% IVA (daños), 10.667% Ret IVA
RESICO: 1.25% ISR, 16% IVA (daños), 10.667% Ret IVA';

COMMENT ON FUNCTION calculate_batch_asimilados_fiscal IS
'Calcula el desglose fiscal ASIMILADOS sobre totales agregados.
ISR Vida: (Total Comisión Vida / 1.16) × 0.10
ISR Daños: (Total Comisión Daños / 1.09) × 0.10';
