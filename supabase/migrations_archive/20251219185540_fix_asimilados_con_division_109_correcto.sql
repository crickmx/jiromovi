/*
  # FIX ASIMILADOS: Implementar fórmula CON división /1.09 según Imagen 1

  ## CRÍTICO: SOLO APLICA A ASIMILADOS

  Este cambio SOLO afecta al régimen fiscal ASIMILADOS.
  Los regímenes RESICO, HONORARIOS y cualquier otro NO se modifican.

  ## Fórmulas Fiscales Correctas (Imagen 1):

  Bases:
  - vida = suma(comision_base donde ramo == "Vida")
  - sinVida = suma(comision_base donde ramo != "Vida")
  - total = vida + sinVida

  Retenciones:
  - retContable = vida × 0.16 (SOLO Vida)
  - costoDispersion = sinVida × 0.09 (SOLO Sin Vida)
  - iva = 0 (siempre para ASIMILADOS)

  ISR (SEPARADO - NO GLOBAL):
  - baseISRVida = (vida - retContable) / 1.09
  - isrVida = baseISRVida × 0.10
  - baseISRDanios = (sinVida - costoDispersion) / 1.09
  - isrDanios = baseISRDanios × 0.10
  - isrTotal = isrVida + isrDanios

  Total Neto:
  - totalNeto = total - retContable - costoDispersion - isrTotal

  Redondeo:
  - Todos los valores se redondean a 2 decimales

  ## Test Bloqueante:

  Caso de prueba:
  - vida = 544.20
  - sinVida = 14,263.87

  Resultado esperado:
  - retContable = 87.07
  - costoDispersion = 1,283.75
  - isrTotal = 1,231.85 (con /1.09)
  - totalNeto = 12,205.40
*/

-- ============================================
-- ELIMINAR FUNCIÓN ANTERIOR
-- ============================================

DROP FUNCTION IF EXISTS calcular_desglose_fiscal_asimilados(UUID, UUID);

-- ============================================
-- CREAR FUNCIÓN CON DIVISIÓN /1.09 (IMAGEN 1)
-- ============================================

CREATE OR REPLACE FUNCTION calcular_desglose_fiscal_asimilados(
  p_batch_id UUID,
  p_agent_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_regimen_fiscal TEXT;
  v_total_comision NUMERIC;
  v_vida NUMERIC := 0;
  v_sin_vida NUMERIC := 0;
  v_ret_contable NUMERIC := 0;
  v_dispersion NUMERIC := 0;
  v_base_isr_vida NUMERIC := 0;
  v_base_isr_danios NUMERIC := 0;
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
  -- PASO 3: APLICAR FÓRMULAS FISCALES CON /1.09
  -- ============================================

  -- Retención Contable (SOLO VIDA)
  v_ret_contable := ROUND((v_vida * 0.16)::numeric, 2);

  -- Costo de Dispersión (SOLO SIN VIDA)
  v_dispersion := ROUND((v_sin_vida * 0.09)::numeric, 2);

  -- Base ISR VIDA = (vida - retContable) / 1.09
  v_base_isr_vida := (v_vida - v_ret_contable) / 1.09;

  -- ISR VIDA = baseISRVida × 0.10
  v_isr_vida := ROUND((v_base_isr_vida * 0.10)::numeric, 2);

  -- Base ISR DAÑOS = (sinVida - costoDispersion) / 1.09
  v_base_isr_danios := (v_sin_vida - v_dispersion) / 1.09;

  -- ISR DAÑOS = baseISRDanios × 0.10
  v_isr_danios := ROUND((v_base_isr_danios * 0.10)::numeric, 2);

  -- ISR TOTAL = isrVida + isrDanios
  v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);

  -- TOTAL A PAGAR = total - retContable - dispersion - isrTotal
  v_total_pagar := ROUND((v_total_comision - v_ret_contable - v_dispersion - v_isr_total)::numeric, 2);

  -- ============================================
  -- PASO 4: RETORNAR RESULTADO COMO JSON
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
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- ÍNDICES PARA OPTIMIZAR CONSULTAS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_commission_details_batch_agent_ramo
  ON commission_details(batch_id, agent_id, LOWER(ramo));

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON FUNCTION calcular_desglose_fiscal_asimilados IS
'FUNCIÓN ÚNICA para calcular desglose fiscal de ASIMILADOS según Imagen 1.

CRÍTICO: SOLO aplica a régimen ASIMILADOS. Otros regímenes NO se ven afectados.

Fórmulas implementadas CON división /1.09:
- retContable = vida × 0.16
- costoDispersion = sinVida × 0.09
- baseISRVida = (vida - retContable) / 1.09
- isrVida = baseISRVida × 0.10
- baseISRDanios = (sinVida - costoDispersion) / 1.09
- isrDanios = baseISRDanios × 0.10
- isrTotal = isrVida + isrDanios
- totalPagar = total - retContable - costoDispersion - isrTotal

Frontend y PDF NO deben recalcular NADA, solo consultar esta función.
Esta es la ÚNICA fuente de verdad para el cálculo fiscal de ASIMILADOS.
';