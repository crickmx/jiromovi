/*
  # Corrección: Usar commission_neta en lugar de commission_bruta

  El cálculo fiscal debe partir de commission_neta (que ya tiene la comisión del agente),
  no de commission_bruta (que es el total antes de aplicar porcentajes).

  También se agrega manejo de ajustes manuales.
*/

-- Actualizar función para usar commission_neta
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
BEGIN
  -- 1. Obtener el agent_id del primer detalle (asumimos que todo el lote es del mismo agente)
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

  -- Normalizar régimen
  v_regimen_fiscal := UPPER(COALESCE(v_regimen_fiscal, 'HONORARIOS'));

  -- ===============================================================================
  -- 🚫 GUARD CLAUSE OBLIGATORIO: ASIMILADOS ES INTOCABLE
  -- ===============================================================================
  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'reason', 'ASIMILADOS es intocable - no se modificó nada',
      'regimen_fiscal', 'ASIMILADOS'
    );
  END IF;

  -- ===============================================================================
  -- SOLO CONTINUAR SI ES HONORARIOS O RESICO
  -- ===============================================================================
  IF v_regimen_fiscal NOT IN ('HONORARIOS', 'RESICO') THEN
    RETURN jsonb_build_object(
      'success', true,
      'skipped', true,
      'reason', 'Régimen no reconocido como HONORARIOS o RESICO',
      'regimen_fiscal', v_regimen_fiscal
    );
  END IF;

  -- 3. Calcular totales por ramo (usar commission_neta, considerar ajustes manuales)
  FOR v_detail IN
    SELECT
      LOWER(COALESCE(ramo, '')) as ramo_lower,
      CASE
        WHEN is_manual_adjusted AND adjusted_commission_neta IS NOT NULL
          THEN adjusted_commission_neta
        ELSE COALESCE(commission_neta, 0)
      END as comision
    FROM commission_details
    WHERE batch_id = p_batch_id
  LOOP
    IF v_detail.ramo_lower = 'vida' THEN
      v_commission_vida := v_commission_vida + v_detail.comision;
    ELSE
      v_commission_sinvida := v_commission_sinvida + v_detail.comision;
    END IF;
  END LOOP;

  v_commission_total := v_commission_vida + v_commission_sinvida;

  -- 4. Calcular impuestos según régimen
  IF v_regimen_fiscal = 'HONORARIOS' THEN
    -- HONORARIOS: Ret. Contable = 0, Costo Dispersión = 0
    v_retencion_contable := 0;
    v_costo_dispersion := 0;

    -- IVA = sinVida × 0.16
    v_iva := ROUND((v_commission_sinvida * 0.16)::numeric, 2);

    -- Ret ISR = total × 0.10
    v_ret_isr := ROUND((v_commission_total * 0.10)::numeric, 2);

    -- Ret IVA = sinVida × 0.10667
    v_ret_iva := ROUND((v_commission_sinvida * 0.10667)::numeric, 2);

    -- Total Neto = total + IVA - Ret ISR - Ret IVA
    v_total_neto := ROUND((v_commission_total + v_iva - v_ret_isr - v_ret_iva)::numeric, 2);

    v_tax_version := 'HONORARIOS_IMAGEN_OFICIAL_V1';

  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- RESICO: Ret. Contable = 0, Costo Dispersión = 0
    v_retencion_contable := 0;
    v_costo_dispersion := 0;

    -- IVA = sinVida × 0.16
    v_iva := ROUND((v_commission_sinvida * 0.16)::numeric, 2);

    -- Ret ISR = total × 0.0125 (1.25%)
    v_ret_isr := ROUND((v_commission_total * 0.0125)::numeric, 2);

    -- Ret IVA = sinVida × 0.10667
    v_ret_iva := ROUND((v_commission_sinvida * 0.10667)::numeric, 2);

    -- Total Neto = total + IVA - Ret ISR - Ret IVA
    v_total_neto := ROUND((v_commission_total + v_iva - v_ret_isr - v_ret_iva)::numeric, 2);

    v_tax_version := 'RESICO_IMAGEN_OFICIAL_V1';
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
    'total_neto', v_total_neto
  );

END;
$$ LANGUAGE plpgsql;
