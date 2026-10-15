/*
  # Habilitar Recálculo Automático para ASIMILADOS

  ## Descripción

  Esta migración modifica la función `calculate_batch_fiscal_aggregates` para:
  1. ELIMINAR el guard clause que bloqueaba el recálculo de ASIMILADOS
  2. AGREGAR lógica de cálculo fiscal para ASIMILADOS
  3. Persistir los valores fiscales en `commission_batches`
  4. Usar las mismas fórmulas validadas que ya existen en `calcular_desglose_fiscal_asimilados`

  ## Fórmulas ASIMILADOS (validadas contra PDF)

  1. Retención Contable = vida × 16%
  2. Costo Dispersión = sinVida × 9%
  3. ISR Vida = (vida - (retContable / 1.09)) × 10%
  4. ISR Daños = (sinVida - (costoDispersion / 1.09)) × 10%
  5. ISR Total = ISR Vida + ISR Daños
  6. Total Neto = totalComision - retContable - dispersion - isrTotal

  ## Notas

  - IVA siempre es 0 para ASIMILADOS
  - ret_iva siempre es 0 para ASIMILADOS
  - Los valores se persisten en commission_batches con tax_version = 'ASIMILADOS_AUTO_V1'
*/

-- Reemplazar función para incluir ASIMILADOS
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

  RAISE NOTICE 'Lote %: % (Régimen: %), % comisiones normales, % ajustadas',
    p_batch_id, v_commission_total, v_regimen_fiscal, v_normal_count, v_adjusted_count;

  -- 4. Calcular impuestos según régimen
  IF v_regimen_fiscal = 'HONORARIOS' THEN
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    v_iva := ROUND((v_commission_sinvida * 0.16)::numeric, 2);
    v_ret_isr := ROUND((v_commission_total * 0.10)::numeric, 2);
    v_ret_iva := ROUND((v_commission_sinvida * 0.10667)::numeric, 2);
    v_total_neto := ROUND((v_commission_total + v_iva - v_ret_isr - v_ret_iva)::numeric, 2);
    v_tax_version := 'HONORARIOS_AJUSTES_MANUALES_V2';

  ELSIF v_regimen_fiscal = 'RESICO' THEN
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    v_iva := ROUND((v_commission_sinvida * 0.16)::numeric, 2);
    v_ret_isr := ROUND((v_commission_total * 0.0125)::numeric, 2);
    v_ret_iva := ROUND((v_commission_sinvida * 0.10667)::numeric, 2);
    v_total_neto := ROUND((v_commission_total + v_iva - v_ret_isr - v_ret_iva)::numeric, 2);
    v_tax_version := 'RESICO_AJUSTES_MANUALES_V2';

  ELSIF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- ============================================
    -- CÁLCULOS FISCALES PARA ASIMILADOS
    -- ============================================

    -- 1. Retención Contable (SOLO VIDA) - 16%
    v_retencion_contable := ROUND((v_commission_vida * 0.16)::numeric, 2);

    -- 2. Costo de Dispersión (SOLO SIN VIDA) - 9%
    v_costo_dispersion := ROUND((v_commission_sinvida * 0.09)::numeric, 2);

    -- 3. IVA = 0 (ASIMILADOS no genera IVA)
    v_iva := 0;

    -- 4. ISR VIDA = (vida - (retContable / 1.09)) × 0.10
    v_isr_vida := ROUND(((v_commission_vida - (v_retencion_contable / 1.09)) * 0.10)::numeric, 2);

    -- 5. ISR DAÑOS = (sinVida - (costoDispersion / 1.09)) × 0.10
    v_isr_danios := ROUND(((v_commission_sinvida - (v_costo_dispersion / 1.09)) * 0.10)::numeric, 2);

    -- 6. ISR TOTAL = ISR Vida + ISR Daños
    v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);

    -- 7. ret_isr (para compatibilidad) = ISR Total
    v_ret_isr := v_isr_total;

    -- 8. ret_iva = 0 (ASIMILADOS no tiene retención de IVA)
    v_ret_iva := 0;

    -- 9. TOTAL NETO = total - retContable - dispersion - isrTotal
    v_total_neto := ROUND((v_commission_total - v_retencion_contable - v_costo_dispersion - v_isr_total)::numeric, 2);

    v_tax_version := 'ASIMILADOS_AUTO_V1';

    RAISE NOTICE 'ASIMILADOS Calculado: Vida=%, SinVida=%, RetCont=%, Disp=%, ISR_Vida=%, ISR_Danios=%, ISR_Total=%, Total_Neto=%',
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

COMMENT ON FUNCTION calculate_batch_fiscal_aggregates IS 'Calcula agregados fiscales para HONORARIOS, RESICO y ASIMILADOS con ajustes manuales. Persiste valores en commission_batches.';