/*
  # Corrección Final: Cálculos Fiscales con Ajustes Manuales

  IMPORTANTE: Esta migración corrige la función calculate_batch_fiscal_aggregates para:
  1. Considerar ajustes manuales (adjusted_commission_neta cuando is_manual_adjusted = true)
  2. Mantener fórmulas exactas según imágenes oficiales
  3. Preservar guard clause para ASIMILADOS (NO TOCAR)

  ## Fórmulas Oficiales

  ### HONORARIOS:
  - Base: commission_neta (o adjusted_commission_neta si is_manual_adjusted)
  - IVA = Sin Vida × 0.16
  - Ret ISR = Total × 0.10
  - Ret IVA = Sin Vida × 0.10667
  - Total Neto = Total + IVA - Ret ISR - Ret IVA

  ### RESICO:
  - Base: commission_neta (o adjusted_commission_neta si is_manual_adjusted)
  - IVA = Sin Vida × 0.16
  - Ret ISR = Total × 0.0125
  - Ret IVA = Sin Vida × 0.10667
  - Total Neto = Total + IVA - Ret ISR - Ret IVA

  ### ASIMILADOS:
  - NO SE MODIFICA (usa su propio sistema)
*/

-- Reemplazar función para considerar ajustes manuales
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

  -- GUARD CLAUSE: ASIMILADOS ES INTOCABLE
  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'reason', 'ASIMILADOS es intocable - no se modificó nada',
      'regimen_fiscal', 'ASIMILADOS'
    );
  END IF;

  -- SOLO CONTINUAR SI ES HONORARIOS O RESICO
  IF v_regimen_fiscal NOT IN ('HONORARIOS', 'RESICO') THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'reason', 'Régimen no reconocido como HONORARIOS o RESICO',
      'regimen_fiscal', v_regimen_fiscal
    );
  END IF;

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

  RAISE NOTICE 'Lote %: % comisiones normales, % ajustadas', p_batch_id, v_normal_count, v_adjusted_count;

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
    'total_neto', v_total_neto,
    'manual_adjustments_count', v_adjusted_count,
    'normal_commissions_count', v_normal_count
  );

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_batch_fiscal_aggregates IS 'Calcula agregados fiscales para HONORARIOS y RESICO con ajustes manuales. ASIMILADOS se salta.';
