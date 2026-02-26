/*
  # Fix: Corregir cálculo ISR para ASIMILADOS

  1. Problema
    - El ISR se está calculando incorrectamente para ASIMILADOS
    - Fórmula actual: (comision / 1.16) * 0.10 o (comision / 1.09) * 0.10
    - Fórmula correcta según PDF oficial:
      * ISR Vida = ((Comisión - Ret. Contable) / 1.09) * 0.10
      * ISR Daños = ((Comisión - Costo Dispersión) / 1.09) * 0.10

  2. Solución
    - Corregir la función calculate_detail_fiscal_values()
    - SIEMPRE restar las retenciones ANTES de dividir por 1.09
    - Recalcular todos los registros existentes de ASIMILADOS
    
  3. Validación con ejemplo del PDF
    - Comisión Base Total: $14,808.07
    - Vida: $544.20, Sin Vida: $14,263.87
    - Ret. Contable: $544.20 × 0.16 = $87.07 ✅
    - Costo Dispersión: $14,263.87 × 0.09 = $1,283.75 ✅
    - Base ISR Vida: ($544.20 - $87.07) / 1.09 = $419.38
    - ISR Vida: $419.38 × 0.10 = $41.94
    - Base ISR Daños: ($14,263.87 - $1,283.75) / 1.09 = $11,908.37
    - ISR Daños: $11,908.37 × 0.10 = $1,190.84
    - ISR Total: $41.94 + $1,190.84 = $1,232.78
    - (Nota: pequeñas diferencias de redondeo pueden ocurrir)
*/

-- Eliminar trigger anterior
DROP TRIGGER IF EXISTS calculate_detail_fiscal_values_trigger ON commission_details;

-- Recrear función con lógica CORRECTA para ASIMILADOS
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
  v_base_isr NUMERIC := 0;
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
    -- 1. Calcular retenciones primero
    IF v_tipo_ramo = 'VIDA' THEN
      v_retencion_contable := v_commission_neta * 0.16;
      v_costo_dispersion := 0;
      -- Base ISR Vida = (Comisión - Ret. Contable) / 1.09
      v_base_isr := (v_commission_neta - v_retencion_contable) / 1.09;
    ELSE
      v_retencion_contable := 0;
      v_costo_dispersion := v_commission_neta * 0.09;
      -- Base ISR Daños = (Comisión - Costo Dispersión) / 1.09
      v_base_isr := (v_commission_neta - v_costo_dispersion) / 1.09;
    END IF;
    
    -- ISR = Base ISR × 0.10
    v_ret_isr := v_base_isr * 0.10;
    
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

-- Recalcular SOLO registros de ASIMILADOS
UPDATE commission_details cd
SET commission_neta = commission_neta
WHERE cd.regimen_fiscal = 'ASIMILADOS';

COMMENT ON FUNCTION calculate_detail_fiscal_values IS
'Calcula automáticamente los valores fiscales de cada commission_detail según el régimen del usuario.
ASIMILADOS: Ret. Contable 16% (Vida), Costo Dispersión 9% (Daños), ISR = ((Comisión - Retención) / 1.09) × 0.10
HONORARIOS: 10% ISR, 16% IVA (daños), 10.667% Ret IVA
RESICO: 1.25% ISR, 16% IVA (daños), 10.667% Ret IVA';
