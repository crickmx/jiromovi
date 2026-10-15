/*
  # Corrección: Recálculo usa régimen fiscal ACTUAL del usuario

  ## Problema
  Al recalcular un lote, se usaba el régimen fiscal guardado en commission_agents.fiscal_regime_id
  (el que tenía cuando se creó el lote). Si el usuario cambió su régimen fiscal después,
  el recálculo usaba el régimen antiguo.

  ## Solución
  Priorizar el régimen fiscal ACTUAL del usuario (usuarios.regimen_fiscal_id).
  Solo usar commission_agents.fiscal_regime_id como fallback.

  ## Ejemplo
  - Usuario tenía HONORARIOS en enero
  - Se crea lote en enero con commission_agents.fiscal_regime_id = HONORARIOS
  - Usuario cambia a RESICO en febrero
  - Al recalcular el lote en marzo, DEBE usar RESICO (actual), NO HONORARIOS (histórico)

  ## Lógica
  1. Intentar obtener régimen de usuarios.regimen_fiscal_id (ACTUAL)
  2. Si no existe, usar commission_agents.fiscal_regime_id (HISTÓRICO)
  3. Si ninguno existe, usar 'HONORARIOS' por defecto
*/

CREATE OR REPLACE FUNCTION calculate_batch_fiscal_aggregates(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_agent_id uuid;
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
  v_ret_isr_temp numeric;
  v_ret_iva_temp numeric;
  v_total_temp numeric;
  v_ret_cont_temp numeric;
  v_disp_temp numeric;
  v_isr_vida_temp numeric;
  v_isr_danios_temp numeric;
  v_isr_total_temp numeric;
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

  -- 2. Obtener usuario_id del agente
  SELECT usuario_id INTO v_usuario_id
  FROM commission_agents
  WHERE id = v_agent_id;

  -- 3. Obtener régimen fiscal ACTUAL del usuario (PRIORIDAD)
  -- Si el usuario cambió su régimen fiscal, usar el nuevo
  -- Si no tiene usuario vinculado, usar el régimen del agente (histórico)
  SELECT 
    COALESCE(
      -- Prioridad 1: Régimen ACTUAL del usuario en tabla usuarios
      (SELECT cfr_user.name 
       FROM usuarios u
       LEFT JOIN commission_fiscal_regimes cfr_user ON u.regimen_fiscal_id = cfr_user.id
       WHERE u.id = v_usuario_id
       LIMIT 1),
      -- Prioridad 2: Régimen guardado en commission_agents (histórico)
      (SELECT cfr_agent.name
       FROM commission_agents ca
       LEFT JOIN commission_fiscal_regimes cfr_agent ON ca.fiscal_regime_id = cfr_agent.id
       WHERE ca.id = v_agent_id
       LIMIT 1),
      -- Prioridad 3: Default HONORARIOS
      'HONORARIOS'
    )
  INTO v_regimen_fiscal;

  v_regimen_fiscal := UPPER(v_regimen_fiscal);

  RAISE NOTICE 'Recalculando lote % - Agent: %, Usuario: %, Régimen ACTUAL: %',
    p_batch_id, v_agent_id, v_usuario_id, v_regimen_fiscal;

  -- 4. Calcular totales por ramo considerando ajustes manuales
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

  -- 5. Calcular impuestos según régimen ACTUAL
  IF v_regimen_fiscal = 'HONORARIOS' THEN
    -- ============================================
    -- HONORARIOS (validado contra CSV)
    -- ============================================
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    
    -- Calcular todo SIN redondear
    v_iva_temp := v_commission_sinvida * 0.16;
    v_ret_isr_temp := v_commission_total * 0.10;
    v_ret_iva_temp := (v_commission_sinvida * 16) / 150;  -- Fracción exacta
    v_total_temp := v_commission_total + v_iva_temp - v_ret_isr_temp - v_ret_iva_temp;
    
    -- Redondear solo al final
    v_iva := ROUND(v_iva_temp::numeric, 2);
    v_ret_isr := ROUND(v_ret_isr_temp::numeric, 2);
    v_ret_iva := ROUND(v_ret_iva_temp::numeric, 2);
    v_total_neto := ROUND(v_total_temp::numeric, 2);
    
    v_tax_version := 'HONORARIOS_CSV_V5_FINAL';

  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- ============================================
    -- RESICO (validado contra CSV)
    -- ============================================
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    
    -- Calcular todo SIN redondear
    v_iva_temp := v_commission_sinvida * 0.16;
    v_ret_isr_temp := v_commission_total * 0.0125;
    v_ret_iva_temp := (v_commission_sinvida * 16) / 150;  -- Fracción exacta
    v_total_temp := v_commission_total + v_iva_temp - v_ret_isr_temp - v_ret_iva_temp;
    
    -- Redondear solo al final
    v_iva := ROUND(v_iva_temp::numeric, 2);
    v_ret_isr := ROUND(v_ret_isr_temp::numeric, 2);
    v_ret_iva := ROUND(v_ret_iva_temp::numeric, 2);
    v_total_neto := ROUND(v_total_temp::numeric, 2);
    
    v_tax_version := 'RESICO_CSV_V5_FINAL';

  ELSIF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- ============================================
    -- ASIMILADOS (validado contra CSV OFICIAL)
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

  -- 6. Persistir en commission_batches
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

  -- 7. Retornar resultado
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
'Recalcula lote usando régimen fiscal ACTUAL del usuario (usuarios.regimen_fiscal_id). 
Fórmulas CSV V5: Ret IVA = (SinVida × 16) / 150, redondeo solo al final.';
