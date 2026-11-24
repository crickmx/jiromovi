/*
  # Corrección del cálculo fiscal para HONORARIOS

  1. Nueva función
    - Calcula desglose fiscal correcto para HONORARIOS según formulas_imp
    - Usa Prima Total (importe_base), NO comisión neta
    - Aplica fórmulas por ramo (Vida vs Sin Vida)

  2. Fórmulas implementadas
    - Retención Contable = Prima Vida × 0.16 (SOLO Vida)
    - Costo Dispersión = Prima Sin Vida × 0.09 (SOLO Sin Vida)
    - ISR Vida = (Prima Vida / 1.16) × 0.10 (NO resta retención)
    - ISR Daños = (Prima Sin Vida / 1.09) × 0.10
    - ISR Total = ISR Vida + ISR Daños
    - Total Final = Prima Total - Retención - Dispersión - ISR Total

  3. Persistencia
    - Guarda resultado en commission_batches.fiscal_desglose_json
    - Incluye todos los valores intermedios para auditoría

  IMPORTANTE:
  - Solo afecta a HONORARIOS, no modifica ASIMILADOS ni otros regímenes
  - La base del cálculo es Prima Total (suma de importe_base)
  - ISR Vida NO resta la retención contable
  - Costo dispersión es 9%, no 10%
*/

-- Función para calcular desglose fiscal de HONORARIOS para un lote
CREATE OR REPLACE FUNCTION calculate_honorarios_fiscal_desglose(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_prima_total numeric := 0;
  v_prima_vida numeric := 0;
  v_prima_sin_vida numeric := 0;
  v_ret_contable numeric := 0;
  v_costo_dispersion numeric := 0;
  v_isr_vida numeric := 0;
  v_isr_danios numeric := 0;
  v_isr_total numeric := 0;
  v_total_final numeric := 0;
  v_result jsonb;
BEGIN
  -- 1. Calcular Prima Vida (suma de importe_base donde ramo = 'Vida')
  SELECT COALESCE(SUM(importe_base), 0) INTO v_prima_vida
  FROM commission_details
  WHERE batch_id = p_batch_id
    AND LOWER(ramo) = 'vida';

  -- 2. Calcular Prima Total (suma de todos los importe_base)
  SELECT COALESCE(SUM(importe_base), 0) INTO v_prima_total
  FROM commission_details
  WHERE batch_id = p_batch_id;

  -- 3. Prima Sin Vida = Prima Total - Prima Vida
  v_prima_sin_vida := v_prima_total - v_prima_vida;

  -- 4. Retención Contable: SOLO en Vida (16%)
  v_ret_contable := ROUND((v_prima_vida * 0.16)::numeric, 2);

  -- 5. Costo de Dispersión: SOLO en Sin Vida (9%, no 10%)
  v_costo_dispersion := ROUND((v_prima_sin_vida * 0.09)::numeric, 2);

  -- 6. ISR Vida: (Prima Vida / 1.16) × 10% - NO resta retención
  IF v_prima_vida > 0 THEN
    v_isr_vida := ROUND(((v_prima_vida / 1.16) * 0.10)::numeric, 2);
  ELSE
    v_isr_vida := 0;
  END IF;

  -- 7. ISR Daños: (Prima Sin Vida / 1.09) × 10%
  IF v_prima_sin_vida > 0 THEN
    v_isr_danios := ROUND(((v_prima_sin_vida / 1.09) * 0.10)::numeric, 2);
  ELSE
    v_isr_danios := 0;
  END IF;

  -- 8. ISR Total
  v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);

  -- 9. Total Final = Prima Total - Retención - Dispersión - ISR Total
  v_total_final := ROUND(
    (v_prima_total - v_ret_contable - v_costo_dispersion - v_isr_total)::numeric,
    2
  );

  -- 10. Construir resultado JSON con todos los valores para auditoría
  v_result := jsonb_build_object(
    'regimen_fiscal', 'HONORARIOS',
    'base_calculo', 'Prima Total (importe_base)',
    'prima_total', v_prima_total,
    'prima_vida', v_prima_vida,
    'prima_sin_vida', v_prima_sin_vida,
    'retencion_contable', v_ret_contable,
    'costo_dispersion', v_costo_dispersion,
    'isr_vida', v_isr_vida,
    'isr_danios', v_isr_danios,
    'isr_total', v_isr_total,
    'total_final', v_total_final,
    'formula_isr_vida', '(Prima Vida / 1.16) × 0.10 (NO resta retención)',
    'formula_isr_danios', '(Prima Sin Vida / 1.09) × 0.10',
    'formula_total', 'Prima Total - Retención - Dispersión - ISR Total',
    'calculated_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Función para calcular desglose fiscal de ASIMILADOS para un lote (mantener sin cambios)
CREATE OR REPLACE FUNCTION calculate_asimilados_fiscal_desglose(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_comision_total numeric := 0;
  v_comision_vida numeric := 0;
  v_comision_sin_vida numeric := 0;
  v_ret_contable numeric := 0;
  v_costo_dispersion numeric := 0;
  v_isr_vida numeric := 0;
  v_isr_danios numeric := 0;
  v_isr_total numeric := 0;
  v_total_final numeric := 0;
  v_result jsonb;
BEGIN
  -- 1. Calcular Comisión Vida (suma de commission_neta donde ramo = 'Vida')
  SELECT COALESCE(SUM(commission_neta), 0) INTO v_comision_vida
  FROM commission_details
  WHERE batch_id = p_batch_id
    AND LOWER(ramo) = 'vida';

  -- 2. Calcular Comisión Total (suma de todos los commission_neta)
  SELECT COALESCE(SUM(commission_neta), 0) INTO v_comision_total
  FROM commission_details
  WHERE batch_id = p_batch_id;

  -- 3. Comisión Sin Vida = Comisión Total - Comisión Vida
  v_comision_sin_vida := v_comision_total - v_comision_vida;

  -- 4. Retención Contable: SOLO en Vida (16%)
  v_ret_contable := ROUND((v_comision_vida * 0.16)::numeric, 2);

  -- 5. Costo de Dispersión: SOLO en Sin Vida (10% para ASIMILADOS)
  v_costo_dispersion := ROUND((v_comision_sin_vida * 0.10)::numeric, 2);

  -- 6. ISR Vida: (Comisión Vida - Retención Contable) × 10%
  v_isr_vida := ROUND(((v_comision_vida - v_ret_contable) * 0.10)::numeric, 2);

  -- 7. ISR Daños: (Comisión Sin Vida - Costo Dispersión) × 10%
  v_isr_danios := ROUND(((v_comision_sin_vida - v_costo_dispersion) * 0.10)::numeric, 2);

  -- 8. ISR Total
  v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);

  -- 9. Total Final = Comisión Total - Retención - Dispersión - ISR Total
  v_total_final := ROUND(
    (v_comision_total - v_ret_contable - v_costo_dispersion - v_isr_total)::numeric,
    2
  );

  -- 10. Construir resultado JSON
  v_result := jsonb_build_object(
    'regimen_fiscal', 'ASIMILADOS',
    'base_calculo', 'Comisión Neta',
    'comision_total', v_comision_total,
    'comision_vida', v_comision_vida,
    'comision_sin_vida', v_comision_sin_vida,
    'retencion_contable', v_ret_contable,
    'costo_dispersion', v_costo_dispersion,
    'isr_vida', v_isr_vida,
    'isr_danios', v_isr_danios,
    'isr_total', v_isr_total,
    'total_final', v_total_final,
    'formula_isr_vida', '(Comisión Vida - Retención Contable) × 0.10',
    'formula_isr_danios', '(Comisión Sin Vida - Dispersión) × 0.10',
    'formula_total', 'Comisión Total - Retención - Dispersión - ISR Total',
    'calculated_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Función unificada para calcular desglose fiscal según régimen del agente
CREATE OR REPLACE FUNCTION calculate_batch_fiscal_desglose(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_agent_id uuid;
  v_regime_name text;
  v_result jsonb;
BEGIN
  -- 1. Obtener el agente del lote (asumiendo que todos los detalles son del mismo agente)
  SELECT DISTINCT agent_id INTO v_agent_id
  FROM commission_details
  WHERE batch_id = p_batch_id
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No se encontró agente para este lote',
      'batch_id', p_batch_id
    );
  END IF;

  -- 2. Obtener régimen fiscal del agente
  SELECT cfr.name INTO v_regime_name
  FROM commission_agents ca
  LEFT JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
  WHERE ca.id = v_agent_id;

  -- 3. Calcular según régimen
  IF UPPER(v_regime_name) = 'HONORARIOS' THEN
    v_result := calculate_honorarios_fiscal_desglose(p_batch_id);
  ELSIF UPPER(v_regime_name) = 'ASIMILADOS' THEN
    v_result := calculate_asimilados_fiscal_desglose(p_batch_id);
  ELSE
    -- Para otros regímenes (RESICO, etc.), implementar después
    v_result := jsonb_build_object(
      'regimen_fiscal', v_regime_name,
      'error', 'Régimen no implementado aún',
      'batch_id', p_batch_id
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Agregar columna para almacenar desglose fiscal en commission_batches (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_batches'
    AND column_name = 'fiscal_desglose_json'
  ) THEN
    ALTER TABLE commission_batches
    ADD COLUMN fiscal_desglose_json jsonb;
  END IF;
END $$;

-- Comentarios para documentación
COMMENT ON FUNCTION calculate_honorarios_fiscal_desglose IS
'Calcula el desglose fiscal para HONORARIOS usando Prima Total (importe_base) como base.
Fórmulas según formulas_imp:
- Retención Contable = Prima Vida × 0.16
- Costo Dispersión = Prima Sin Vida × 0.09
- ISR Vida = (Prima Vida / 1.16) × 0.10 (NO resta retención)
- ISR Daños = (Prima Sin Vida / 1.09) × 0.10
- Total Final = Prima Total - Retención - Dispersión - ISR Total';

COMMENT ON FUNCTION calculate_asimilados_fiscal_desglose IS
'Calcula el desglose fiscal para ASIMILADOS usando Comisión Neta como base.
Fórmulas:
- Retención Contable = Comisión Vida × 0.16
- Costo Dispersión = Comisión Sin Vida × 0.10
- ISR Vida = (Comisión Vida - Retención) × 0.10
- ISR Daños = (Comisión Sin Vida - Dispersión) × 0.10
- Total Final = Comisión Total - Retención - Dispersión - ISR Total';

COMMENT ON FUNCTION calculate_batch_fiscal_desglose IS
'Función unificada que detecta el régimen fiscal del agente y aplica el cálculo correspondiente.
Regímenes soportados: HONORARIOS, ASIMILADOS.';

COMMENT ON COLUMN commission_batches.fiscal_desglose_json IS
'Desglose fiscal completo del lote calculado según el régimen del agente.
Incluye todos los valores intermedios para auditoría y trazabilidad.';
