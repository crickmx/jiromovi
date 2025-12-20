/*
  # Corregir función calcular_desglose_fiscal_asimilados con fórmulas CSV

  ## Fórmulas Correctas (CSV Oficial)
  - ISR Vida = (Vida / 1.16) × 10%
  - ISR Daños = (SinVida / 1.09) × 10%

  ## Ejemplo (CSV)
  - Vida: $544.20
  - Sin Vida: $14,263.87
  - ISR Vida = (544.20 / 1.16) × 0.10 = $46.91 ✓
  - ISR Daños = (14,263.87 / 1.09) × 0.10 = $1,308.43 ✓
  - ISR Total = $1,355.53 ✓
*/

CREATE OR REPLACE FUNCTION calcular_desglose_fiscal_asimilados(
  p_batch_id UUID,
  p_agent_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_regimen_fiscal TEXT;
  v_total_comision NUMERIC;
  v_vida NUMERIC := 0;
  v_sin_vida NUMERIC := 0;
  
  -- Variables temporales SIN redondear
  v_ret_contable_temp NUMERIC := 0;
  v_dispersion_temp NUMERIC := 0;
  v_isr_vida_temp NUMERIC := 0;
  v_isr_danios_temp NUMERIC := 0;
  v_isr_total_temp NUMERIC := 0;
  v_total_pagar_temp NUMERIC := 0;
  
  -- Variables finales redondeadas
  v_ret_contable NUMERIC := 0;
  v_dispersion NUMERIC := 0;
  v_isr_vida NUMERIC := 0;
  v_isr_danios NUMERIC := 0;
  v_isr_total NUMERIC := 0;
  v_total_pagar NUMERIC := 0;
  
  v_result JSON;
BEGIN
  -- ============================================
  -- PASO 1: VERIFICAR RÉGIMEN FISCAL
  -- ============================================
  
  SELECT UPPER(COALESCE(cfr.name, cfr2.name, 'HONORARIOS'))
  INTO v_regimen_fiscal
  FROM commission_agents ca
  LEFT JOIN usuarios u ON ca.usuario_id = u.id
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  LEFT JOIN commission_fiscal_regimes cfr2 ON ca.fiscal_regime_id = cfr2.id
  WHERE ca.id = p_agent_id;
  
  -- Si no es ASIMILADOS, retornar valores en cero
  IF v_regimen_fiscal IS NULL OR v_regimen_fiscal NOT LIKE '%ASIMILAD%' THEN
    RETURN json_build_object(
      'regimen_fiscal', COALESCE(v_regimen_fiscal, 'DESCONOCIDO'),
      'es_asimilados', false,
      'total_comision', 0,
      'vida', 0,
      'sin_vida', 0,
      'ret_contable', 0,
      'dispersion', 0,
      'iva', 0,
      'isr_vida', 0,
      'isr_danios', 0,
      'isr_total', 0,
      'total_pagar', 0
    );
  END IF;
  
  -- ============================================
  -- PASO 2: SUMAR COMISIONES POR VIDA Y SIN VIDA
  -- ============================================
  
  SELECT
    SUM(CASE
      WHEN cd.is_manual_adjusted THEN COALESCE(cd.adjusted_commission_neta, 0)
      ELSE cd.commission_neta
    END),
    SUM(CASE
      WHEN LOWER(cd.ramo) = 'vida' THEN
        CASE
          WHEN cd.is_manual_adjusted THEN COALESCE(cd.adjusted_commission_neta, 0)
          ELSE cd.commission_neta
        END
      ELSE 0
    END),
    SUM(CASE
      WHEN LOWER(cd.ramo) != 'vida' THEN
        CASE
          WHEN cd.is_manual_adjusted THEN COALESCE(cd.adjusted_commission_neta, 0)
          ELSE cd.commission_neta
        END
      ELSE 0
    END)
  INTO v_total_comision, v_vida, v_sin_vida
  FROM commission_details cd
  WHERE cd.batch_id = p_batch_id
    AND cd.agent_id = p_agent_id;
  
  -- Garantizar valores no nulos
  v_total_comision := COALESCE(v_total_comision, 0);
  v_vida := COALESCE(v_vida, 0);
  v_sin_vida := COALESCE(v_sin_vida, 0);
  
  -- ============================================
  -- PASO 3: CALCULAR TODO SIN REDONDEAR
  -- FÓRMULAS CORREGIDAS según CSV oficial
  -- ============================================
  
  -- Retención Contable (SOLO VIDA) - 16%
  v_ret_contable_temp := v_vida * 0.16;
  
  -- Costo de Dispersión (SOLO SIN VIDA) - 9%
  v_dispersion_temp := v_sin_vida * 0.09;
  
  -- ISR VIDA = (Vida / 1.16) × 0.10
  -- CSV: =(544/1.16)*.10
  v_isr_vida_temp := (v_vida / 1.16) * 0.10;
  
  -- ISR DAÑOS = (SinVida / 1.09) × 0.10
  -- CSV: =((14808.07-544.20)/1.09)*0.1
  v_isr_danios_temp := (v_sin_vida / 1.09) * 0.10;
  
  -- ISR TOTAL = ISR Vida + ISR Daños
  v_isr_total_temp := v_isr_vida_temp + v_isr_danios_temp;
  
  -- TOTAL A PAGAR = total - retContable - dispersion - isrTotal
  v_total_pagar_temp := v_total_comision - v_ret_contable_temp - v_dispersion_temp - v_isr_total_temp;
  
  -- ============================================
  -- PASO 4: REDONDEAR TODO AL FINAL
  -- ============================================
  
  v_ret_contable := ROUND(v_ret_contable_temp::numeric, 2);
  v_dispersion := ROUND(v_dispersion_temp::numeric, 2);
  v_isr_vida := ROUND(v_isr_vida_temp::numeric, 2);
  v_isr_danios := ROUND(v_isr_danios_temp::numeric, 2);
  v_isr_total := ROUND(v_isr_total_temp::numeric, 2);
  v_total_pagar := ROUND(v_total_pagar_temp::numeric, 2);
  
  -- ============================================
  -- PASO 5: RETORNAR RESULTADO COMO JSON
  -- ============================================
  
  v_result := json_build_object(
    'regimen_fiscal', v_regimen_fiscal,
    'es_asimilados', true,
    'total_comision', v_total_comision,
    'vida', v_vida,
    'sin_vida', v_sin_vida,
    'ret_contable', v_ret_contable,
    'dispersion', v_dispersion,
    'iva', 0.00,
    'isr_vida', v_isr_vida,
    'isr_danios', v_isr_danios,
    'isr_total', v_isr_total,
    'total_pagar', v_total_pagar
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION calcular_desglose_fiscal_asimilados IS 'Fórmulas ASIMILADOS según CSV oficial: ISR Vida = Vida/1.16, ISR Daños = SinVida/1.09';
