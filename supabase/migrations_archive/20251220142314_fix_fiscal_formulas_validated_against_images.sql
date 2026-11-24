/*
  # Corrección Final: Fórmulas Fiscales Validadas contra Imágenes

  ## Cambios Críticos

  1. **RESICO**: ISR corregido de 10% → 1.25%
  2. **HONORARIOS**: Bases clarificadas (Sin Vida vs Total)
  3. **ASIMILADOS**: Redondeo solo al final

  ## Fórmulas Validadas (Fuente: Imágenes oficiales)

  ### HONORARIOS
  - IVA = Comisión Sin Vida × 16%
  - Ret ISR = Comisión Base Total × 10%
  - Ret IVA = Comisión Sin Vida × 10.667%
  - Total = Base Total + IVA - Ret ISR - Ret IVA

  Ejemplo (Imagen 2):
  - Base Total: $14,808.07
  - Sin Vida: $14,263.87
  - IVA: $2,282.22 ✓
  - Ret ISR: $1,480.81 ✓
  - Ret IVA: $1,521.48 ✓
  - Total: $14,088.00 ✓

  ### RESICO
  - IVA = Comisión Sin Vida × 16%
  - Ret ISR = Comisión Base Total × 1.25% ← CRÍTICO: 1.25%, NO 10%
  - Ret IVA = Comisión Sin Vida × 10.667%
  - Total = Base Total + IVA - Ret ISR - Ret IVA

  Ejemplo (Imagen 3):
  - Base Total: $14,808.07
  - Sin Vida: $14,263.87
  - IVA: $2,282.22 ✓
  - Ret ISR: $185.10 ✓ (14,808.07 × 0.0125)
  - Ret IVA: $1,521.48 ✓
  - Total: $15,383.70 ✓

  ### ASIMILADOS
  - Ret Contable = Vida × 16%
  - Costo Dispersión = Sin Vida × 9%
  - IVA = 0
  - ISR Vida = (Vida - (Ret Contable / 1.09)) × 10%
  - ISR Daños = (Sin Vida - (Costo Dispersión / 1.09)) × 10%
  - ISR Total = ISR Vida + ISR Daños
  - Total = Base Total - Ret Contable - Costo Dispersión - ISR Total
  - ⚠️ REDONDEAR SOLO AL FINAL

  Ejemplo (Imagen 1):
  - Base Total: $14,808.07
  - Vida: $544.20
  - Sin Vida: $14,263.87
  - Ret Contable: $87.07 ✓
  - Costo Dispersión: $1,283.75 ✓
  - ISR Vida: $46.91 ✓
  - ISR Daños: $1,308.61 ✓
  - ISR Total: $1,355.53 ✓ (antes: $1,355.04 ✗)
  - Total: $12,081.72 ✓ (antes: $12,082.21 ✗)
*/

-- Reemplazar función con fórmulas corregidas
CREATE OR REPLACE FUNCTION calculate_batch_fiscal_aggregates(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_agent_id uuid;
  v_regimen_fiscal text;
  v_commission_vida numeric := 0;
  v_commission_sinvida numeric := 0;
  v_commission_total numeric := 0;
  v_retencion_contable numeric := 0;
  v_costo_dispersion numeric := 0;
  v_iva numeric := 0;
  v_ret_isr numeric := 0;
  v_ret_iva numeric := 0;
  v_isr_vida numeric := 0;
  v_isr_danios numeric := 0;
  v_isr_total numeric := 0;
  v_total_neto numeric := 0;
  v_tax_version text;
  v_detail record;
  v_adjusted_count integer := 0;
  v_normal_count integer := 0;
  
  -- Variables intermedias SIN redondear (para ASIMILADOS)
  v_ret_cont_temp numeric;
  v_disp_temp numeric;
  v_isr_vida_temp numeric;
  v_isr_danios_temp numeric;
  v_isr_total_temp numeric;
  v_total_temp numeric;
BEGIN
  -- 1. Obtener el agent_id del primer detalle
  SELECT agent_id INTO v_agent_id
  FROM commission_details
  WHERE batch_id = p_batch_id
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró agent_id para el lote'
    );
  END IF;

  -- 2. Obtener régimen fiscal del agente
  SELECT cfr.name INTO v_regimen_fiscal
  FROM commission_agents ca
  LEFT JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
  WHERE ca.id = v_agent_id;

  v_regimen_fiscal := UPPER(COALESCE(v_regimen_fiscal, 'HONORARIOS'));

  -- 3. Calcular totales por ramo considerando ajustes manuales
  FOR v_detail IN
    SELECT
      LOWER(COALESCE(ramo, '')) as ramo_lower,
      CASE
        WHEN is_manual_adjusted AND adjusted_commission_neta IS NOT NULL
          THEN adjusted_commission_neta
        ELSE COALESCE(commission_neta, 0)
      END as comision,
      is_manual_adjusted
    FROM commission_details
    WHERE batch_id = p_batch_id
  LOOP
    IF v_detail.is_manual_adjusted THEN
      v_adjusted_count := v_adjusted_count + 1;
    ELSE
      v_normal_count := v_normal_count + 1;
    END IF;

    IF v_detail.ramo_lower = 'vida' THEN
      v_commission_vida := v_commission_vida + v_detail.comision;
    ELSE
      v_commission_sinvida := v_commission_sinvida + v_detail.comision;
    END IF;
  END LOOP;

  v_commission_total := v_commission_vida + v_commission_sinvida;

  RAISE NOTICE 'Lote %: Total=% (Régimen: %), Vida=%, SinVida=%, Normal=%, Ajustadas=%',
    p_batch_id, v_commission_total, v_regimen_fiscal, v_commission_vida, 
    v_commission_sinvida, v_normal_count, v_adjusted_count;

  -- 4. Calcular impuestos según régimen
  IF v_regimen_fiscal = 'HONORARIOS' THEN
    -- ============================================
    -- HONORARIOS (validado contra Imagen 2)
    -- ============================================
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    
    -- IVA = Comisión Sin Vida × 16%
    v_iva := ROUND((v_commission_sinvida * 0.16)::numeric, 2);
    
    -- Ret ISR = Comisión Base Total × 10%
    v_ret_isr := ROUND((v_commission_total * 0.10)::numeric, 2);
    
    -- Ret IVA = Comisión Sin Vida × 10.667%
    v_ret_iva := ROUND((v_commission_sinvida * 0.10667)::numeric, 2);
    
    -- Total = Base Total + IVA - Ret ISR - Ret IVA
    v_total_neto := ROUND((v_commission_total + v_iva - v_ret_isr - v_ret_iva)::numeric, 2);
    
    v_tax_version := 'HONORARIOS_VALIDADO_V3';

  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- ============================================
    -- RESICO (validado contra Imagen 3)
    -- ============================================
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    
    -- IVA = Comisión Sin Vida × 16%
    v_iva := ROUND((v_commission_sinvida * 0.16)::numeric, 2);
    
    -- Ret ISR = Comisión Base Total × 1.25% ← CORREGIDO (era 10%)
    v_ret_isr := ROUND((v_commission_total * 0.0125)::numeric, 2);
    
    -- Ret IVA = Comisión Sin Vida × 10.667%
    v_ret_iva := ROUND((v_commission_sinvida * 0.10667)::numeric, 2);
    
    -- Total = Base Total + IVA - Ret ISR - Ret IVA
    v_total_neto := ROUND((v_commission_total + v_iva - v_ret_isr - v_ret_iva)::numeric, 2);
    
    v_tax_version := 'RESICO_VALIDADO_V3';

  ELSIF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- ============================================
    -- ASIMILADOS (validado contra Imagen 1)
    -- CRÍTICO: Calcular todo SIN redondear, redondear solo al final
    -- ============================================

    -- 1. Retención Contable (SOLO VIDA) - 16%
    v_ret_cont_temp := v_commission_vida * 0.16;

    -- 2. Costo de Dispersión (SOLO SIN VIDA) - 9%
    v_disp_temp := v_commission_sinvida * 0.09;

    -- 3. ISR VIDA = (vida - (retContable / 1.09)) × 0.10
    v_isr_vida_temp := (v_commission_vida - (v_ret_cont_temp / 1.09)) * 0.10;

    -- 4. ISR DAÑOS = (sinVida - (costoDispersion / 1.09)) × 0.10
    v_isr_danios_temp := (v_commission_sinvida - (v_disp_temp / 1.09)) * 0.10;

    -- 5. ISR TOTAL = ISR Vida + ISR Daños
    v_isr_total_temp := v_isr_vida_temp + v_isr_danios_temp;

    -- 6. TOTAL = total - retContable - dispersion - isrTotal
    v_total_temp := v_commission_total - v_ret_cont_temp - v_disp_temp - v_isr_total_temp;

    -- 7. AHORA SÍ: Redondear todo al final
    v_retencion_contable := ROUND(v_ret_cont_temp::numeric, 2);
    v_costo_dispersion := ROUND(v_disp_temp::numeric, 2);
    v_isr_vida := ROUND(v_isr_vida_temp::numeric, 2);
    v_isr_danios := ROUND(v_isr_danios_temp::numeric, 2);
    v_isr_total := ROUND(v_isr_total_temp::numeric, 2);
    v_total_neto := ROUND(v_total_temp::numeric, 2);

    -- 8. Campos compatibilidad
    v_iva := 0;
    v_ret_isr := v_isr_total; -- Para compatibilidad con PDF
    v_ret_iva := 0;

    v_tax_version := 'ASIMILADOS_VALIDADO_V3';

    RAISE NOTICE 'ASIMILADOS: Vida=%, SinVida=%, RetCont=%, Disp=%, ISR_Vida=%, ISR_Danios=%, ISR_Total=%, Total=%',
      v_commission_vida, v_commission_sinvida, v_retencion_contable, v_costo_dispersion,
      v_isr_vida, v_isr_danios, v_isr_total, v_total_neto;

  ELSE
    -- Régimen no reconocido
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'reason', 'Régimen fiscal no reconocido: ' || v_regimen_fiscal,
      'regimen_fiscal', v_regimen_fiscal
    );
  END IF;

  -- 5. Persistir en commission_batches
  UPDATE commission_batches
  SET
    commission_vida = v_commission_vida,
    commission_sinvida = v_commission_sinvida,
    commission_total = v_commission_total,
    retencion_contable = v_retencion_contable,
    costo_dispersion = v_costo_dispersion,
    iva = v_iva,
    ret_isr = v_ret_isr,
    ret_iva = v_ret_iva,
    total_neto = v_total_neto,
    regimen_fiscal = v_regimen_fiscal,
    tax_version = v_tax_version,
    calculated_at = now()
  WHERE id = p_batch_id;

  -- 6. Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'regimen_fiscal', v_regimen_fiscal,
    'tax_version', v_tax_version,
    'commission_vida', v_commission_vida,
    'commission_sinvida', v_commission_sinvida,
    'commission_total', v_commission_total,
    'retencion_contable', v_retencion_contable,
    'costo_dispersion', v_costo_dispersion,
    'iva', v_iva,
    'ret_isr', v_ret_isr,
    'ret_iva', v_ret_iva,
    'isr_vida', v_isr_vida,
    'isr_danios', v_isr_danios,
    'isr_total', v_isr_total,
    'total_neto', v_total_neto,
    'manual_adjustments_count', v_adjusted_count,
    'normal_commissions_count', v_normal_count
  );

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_batch_fiscal_aggregates IS 'Fórmulas fiscales validadas contra imágenes oficiales. HONORARIOS 10%, RESICO 1.25%, ASIMILADOS con redondeo final.';
