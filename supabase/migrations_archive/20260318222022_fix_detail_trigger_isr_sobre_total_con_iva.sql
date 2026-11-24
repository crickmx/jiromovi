/*
  # Fix trigger de cálculo fiscal para commission_details

  ## Problema detectado
  El trigger calculate_detail_fiscal_values calcula ISR sobre commission_bruta
  cuando debería calcularlo sobre (commission_bruta + IVA)

  ## Fórmulas correctas para consistencia con calculate_batch_fiscal_aggregates

  ### HONORARIOS:
  - Subtotal con IVA = Commission Bruta + IVA
  - Retención ISR = (Commission Bruta + IVA) × 10%
  - Retención IVA = IVA × 2/3
  - Total Neto = Subtotal con IVA - Ret ISR - Ret IVA

  ### RESICO:
  - Subtotal con IVA = Commission Bruta + IVA
  - Retención ISR = (Commission Bruta + IVA) × 1.25%
  - Retención IVA = IVA × 2/3
  - Total Neto = Subtotal con IVA - Ret ISR - Ret IVA
*/

DROP TRIGGER IF EXISTS calculate_detail_fiscal_values_trigger ON commission_details;

CREATE OR REPLACE FUNCTION calculate_detail_fiscal_values()
RETURNS TRIGGER AS $$
DECLARE
  v_regimen_fiscal TEXT;
  v_commission_bruta NUMERIC;
  v_tipo_ramo TEXT;
  v_iva NUMERIC := 0;
  v_subtotal_con_iva NUMERIC := 0;
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

  -- Usar commission_bruta como base para HONORARIOS y RESICO
  v_commission_bruta := COALESCE(NEW.commission_bruta, 0);

  -- =============================================
  -- CÁLCULOS SEGÚN RÉGIMEN FISCAL
  -- =============================================

  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- ===== ASIMILADOS (NO TOCAR - MANTENER CÁLCULO ACTUAL) =====
    DECLARE
      v_commission_neta NUMERIC := COALESCE(NEW.commission_neta, 0);
    BEGIN
      IF v_tipo_ramo = 'VIDA' THEN
        v_retencion_contable := v_commission_neta * 0.16;
      ELSE
        v_costo_dispersion := v_commission_neta * 0.09;
      END IF;

      -- ISR: 10% sobre el neto después de retenciones
      IF v_tipo_ramo = 'VIDA' THEN
        v_ret_isr := (v_commission_neta / 1.16) * 0.10;
      ELSE
        v_ret_isr := (v_commission_neta / 1.09) * 0.10;
      END IF;

      v_iva := 0;
      v_ret_iva := 0;
      v_total_neto := v_commission_neta - v_retencion_contable - v_costo_dispersion - v_ret_isr;
    END;

  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- ===== RESICO - FÓRMULAS CORREGIDAS =====
    -- Base: Commission Bruta
    -- IVA solo aplica en Daños (16%)
    IF v_tipo_ramo != 'VIDA' THEN
      v_iva := v_commission_bruta * 0.16;
    END IF;

    -- Subtotal con IVA
    v_subtotal_con_iva := v_commission_bruta + v_iva;

    -- CORRECCIÓN: Retención ISR = (Bruta + IVA) × 1.25%
    v_ret_isr := v_subtotal_con_iva * 0.0125;

    -- Retención IVA = IVA × 2/3 (66.67%)
    v_ret_iva := v_iva * (2.0 / 3.0);

    -- Total Neto = Subtotal con IVA - Ret ISR - Ret IVA
    v_total_neto := v_subtotal_con_iva - v_ret_isr - v_ret_iva;

  ELSE
    -- ===== HONORARIOS - FÓRMULAS CORREGIDAS =====
    -- Base: Commission Bruta
    -- IVA solo aplica en Daños (16%)
    IF v_tipo_ramo != 'VIDA' THEN
      v_iva := v_commission_bruta * 0.16;
    END IF;

    -- Subtotal con IVA
    v_subtotal_con_iva := v_commission_bruta + v_iva;

    -- CORRECCIÓN: Retención ISR = (Bruta + IVA) × 10%
    v_ret_isr := v_subtotal_con_iva * 0.10;

    -- Retención IVA = IVA × 2/3 (66.67%)
    v_ret_iva := v_iva * (2.0 / 3.0);

    -- Total Neto = Subtotal con IVA - Ret ISR - Ret IVA
    v_total_neto := v_subtotal_con_iva - v_ret_isr - v_ret_iva;
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
  BEFORE INSERT OR UPDATE OF commission_bruta, commission_neta, usuario_id, ramo
  ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION calculate_detail_fiscal_values();

COMMENT ON FUNCTION calculate_detail_fiscal_values IS
'Calcula automáticamente los valores fiscales de cada commission_detail según el régimen del usuario.
CORRECCIÓN V6: ISR de HONORARIOS (10%) y RESICO (1.25%) se calcula sobre (Commission Bruta + IVA).
HONORARIOS: Ret ISR = (Bruta + IVA) × 10%, Ret IVA = IVA × 2/3
RESICO: Ret ISR = (Bruta + IVA) × 1.25%, Ret IVA = IVA × 2/3
ASIMILADOS: Base = Commission Neta (mantiene cálculo original sin cambios)';
