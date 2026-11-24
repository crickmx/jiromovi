/*
  # Corrección fórmula Retención IVA para HONORARIOS y RESICO

  ## Problema detectado
  La retención de IVA usa la fórmula: (Sin Vida × 16) / 150
  Esto resulta en 10.67% de Sin Vida, que NO es correcto.

  ## Fórmula CORRECTA
  La retención de IVA debe ser 2/3 (66.67%) del IVA causado:
  
  Ret IVA = IVA × (2/3)
  
  Donde IVA = Sin Vida × 0.16
  
  Por lo tanto: Ret IVA = (Sin Vida × 0.16) × (2/3) = Sin Vida × 0.10667
  
  ## Explicación
  En México, para servicios profesionales (Honorarios) y RESICO:
  - Se causa IVA del 16% sobre los ingresos (solo en Daños/Sin Vida)
  - El pagador retiene 2/3 (dos terceras partes) del IVA causado
  - El prestador del servicio paga el 1/3 restante al SAT
  
  ## Cambio aplicado
  ANTES: v_ret_iva_temp := (v_commission_sinvida * 16) / 150;
  AHORA: v_ret_iva_temp := v_iva_temp * (2.0 / 3.0);
*/

CREATE OR REPLACE FUNCTION calculate_batch_fiscal_aggregates(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_usuario_id uuid;
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
  
  -- Variables temporales SIN redondear
  v_iva_temp numeric;
  v_subtotal_con_iva_temp numeric;
  v_ret_isr_temp numeric;
  v_ret_iva_temp numeric;
  v_total_temp numeric;
  v_ret_cont_temp numeric;
  v_disp_temp numeric;
  v_isr_vida_temp numeric;
  v_isr_danios_temp numeric;
  v_isr_total_temp numeric;
BEGIN
  -- 1. Obtener el usuario_id del primer detalle
  SELECT usuario_id INTO v_usuario_id
  FROM commission_details
  WHERE batch_id = p_batch_id
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se encontró usuario_id para el lote'
    );
  END IF;

  -- 2. Obtener régimen fiscal ACTUAL del usuario
  SELECT COALESCE(cfr.name, 'HONORARIOS')
  INTO v_regimen_fiscal
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE u.id = v_usuario_id;

  v_regimen_fiscal := UPPER(v_regimen_fiscal);

  RAISE NOTICE 'Recalculando lote % - Usuario: %, Régimen ACTUAL: %',
    p_batch_id, v_usuario_id, v_regimen_fiscal;

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

  -- 4. Calcular impuestos según régimen ACTUAL
  IF v_regimen_fiscal = 'HONORARIOS' THEN
    -- ============================================
    -- HONORARIOS
    -- ============================================
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    
    -- Calcular todo SIN redondear
    -- IVA = Sin Vida × 16%
    v_iva_temp := v_commission_sinvida * 0.16;
    
    -- Subtotal con IVA = Total + IVA
    v_subtotal_con_iva_temp := v_commission_total + v_iva_temp;
    
    -- Ret ISR = (Total + IVA) × 10%
    v_ret_isr_temp := v_subtotal_con_iva_temp * 0.10;
    
    -- CORRECCIÓN: Ret IVA = IVA × 2/3 (dos tercios del IVA causado)
    v_ret_iva_temp := v_iva_temp * (2.0 / 3.0);
    
    -- Total Neto = Subtotal con IVA - Ret ISR - Ret IVA
    v_total_temp := v_subtotal_con_iva_temp - v_ret_isr_temp - v_ret_iva_temp;
    
    -- Redondear solo al final
    v_iva := ROUND(v_iva_temp::numeric, 2);
    v_ret_isr := ROUND(v_ret_isr_temp::numeric, 2);
    v_ret_iva := ROUND(v_ret_iva_temp::numeric, 2);
    v_total_neto := ROUND(v_total_temp::numeric, 2);
    
    v_tax_version := 'HONORARIOS_V7_RET_IVA_2_TERCIOS';

  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- ============================================
    -- RESICO
    -- ============================================
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    
    -- Calcular todo SIN redondear
    -- IVA = Sin Vida × 16%
    v_iva_temp := v_commission_sinvida * 0.16;
    
    -- Subtotal con IVA = Total + IVA
    v_subtotal_con_iva_temp := v_commission_total + v_iva_temp;
    
    -- Ret ISR = (Total + IVA) × 1.25%
    v_ret_isr_temp := v_subtotal_con_iva_temp * 0.0125;
    
    -- CORRECCIÓN: Ret IVA = IVA × 2/3 (dos tercios del IVA causado)
    v_ret_iva_temp := v_iva_temp * (2.0 / 3.0);
    
    -- Total Neto = Subtotal con IVA - Ret ISR - Ret IVA
    v_total_temp := v_subtotal_con_iva_temp - v_ret_isr_temp - v_ret_iva_temp;
    
    -- Redondear solo al final
    v_iva := ROUND(v_iva_temp::numeric, 2);
    v_ret_isr := ROUND(v_ret_isr_temp::numeric, 2);
    v_ret_iva := ROUND(v_ret_iva_temp::numeric, 2);
    v_total_neto := ROUND(v_total_temp::numeric, 2);
    
    v_tax_version := 'RESICO_V7_RET_IVA_2_TERCIOS';

  ELSIF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- ============================================
    -- ASIMILADOS (validado contra CSV OFICIAL - SIN CAMBIOS)
    -- ============================================

    -- Calcular todo SIN redondear
    v_ret_cont_temp := v_commission_vida * 0.16;
    v_disp_temp := v_commission_sinvida * 0.09;
    v_isr_vida_temp := (v_commission_vida / 1.16) * 0.10;
    v_isr_danios_temp := (v_commission_sinvida / 1.09) * 0.10;
    v_isr_total_temp := v_isr_vida_temp + v_isr_danios_temp;
    v_total_temp := v_commission_total - v_ret_cont_temp - v_disp_temp - v_isr_total_temp;

    -- Redondear solo al final
    v_retencion_contable := ROUND(v_ret_cont_temp::numeric, 2);
    v_costo_dispersion := ROUND(v_disp_temp::numeric, 2);
    v_isr_vida := ROUND(v_isr_vida_temp::numeric, 2);
    v_isr_danios := ROUND(v_isr_danios_temp::numeric, 2);
    v_isr_total := ROUND(v_isr_total_temp::numeric, 2);
    v_total_neto := ROUND(v_total_temp::numeric, 2);

    -- Campos compatibilidad
    v_iva := 0;
    v_ret_isr := v_isr_total;
    v_ret_iva := 0;

    v_tax_version := 'ASIMILADOS_CSV_V5_FINAL';

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
    'normal_commissions_count', v_normal_count,
    'usuario_id', v_usuario_id
  );

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_batch_fiscal_aggregates IS 
'CORRECCIÓN V7: Ret IVA = IVA × (2/3) exacto. ISR sobre (Total + IVA).
HONORARIOS: Ret ISR = (Total + IVA) × 10%, Ret IVA = IVA × 2/3
RESICO: Ret ISR = (Total + IVA) × 1.25%, Ret IVA = IVA × 2/3
ASIMILADOS: Sin cambios.';
