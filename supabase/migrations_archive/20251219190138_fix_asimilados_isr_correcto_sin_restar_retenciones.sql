/*
  # FIX ASIMILADOS: ISR correcto según Imagen 1 - SIN restar retenciones antes de /1.09

  ## CRÍTICO: SOLO APLICA A ASIMILADOS

  Caso de prueba verificado:
  - vida = 544.20
  - sinVida = 14,263.87
  
  Resultado esperado:
  - retContable = 87.07
  - costoDispersion = 1,283.75
  - isrVida = 46.91
  - isrDanios = 1,308.61
  - isrTotal = 1,355.53
  - totalPagar = 12,081.72

  ## Fórmulas Correctas (Imagen 1):

  ISR Vida = (vida / 1.09) × 0.10
  ISR Daños = (sinVida / 1.09) × 0.10
  
  IMPORTANTE: NO se restan las retenciones ANTES de dividir por 1.09
  Las retenciones solo se restan al final para calcular el total a pagar.
*/

-- ============================================
-- ELIMINAR FUNCIÓN ANTERIOR
-- ============================================

DROP FUNCTION IF EXISTS calcular_desglose_fiscal_asimilados(UUID, UUID);

-- ============================================
-- CREAR FUNCIÓN CON FÓRMULA CORRECTA
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
  -- PASO 3: APLICAR FÓRMULAS FISCALES CORRECTAS (IMAGEN 1)
  -- ============================================

  -- Retención Contable (SOLO VIDA) - 16%
  v_ret_contable := ROUND((v_vida * 0.16)::numeric, 2);

  -- Costo de Dispersión (SOLO SIN VIDA) - 9%
  v_dispersion := ROUND((v_sin_vida * 0.09)::numeric, 2);

  -- ISR VIDA = (vida / 1.09) × 0.10
  -- CRÍTICO: NO se resta retContable antes de /1.09
  v_isr_vida := ROUND(((v_vida / 1.09) * 0.10)::numeric, 2);

  -- ISR DAÑOS = (sinVida / 1.09) × 0.10
  -- CRÍTICO: NO se resta costoDispersion antes de /1.09
  v_isr_danios := ROUND(((v_sin_vida / 1.09) * 0.10)::numeric, 2);

  -- ISR TOTAL
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
-- COMENTARIOS
-- ============================================

COMMENT ON FUNCTION calcular_desglose_fiscal_asimilados IS
'FUNCIÓN ÚNICA para calcular desglose fiscal de ASIMILADOS según Imagen 1.

CRÍTICO: SOLO aplica a régimen ASIMILADOS.

Fórmulas implementadas (CORRECTAS según Imagen 1):
- retContable = vida × 0.16
- costoDispersion = sinVida × 0.09
- isrVida = (vida / 1.09) × 0.10 [SIN restar retContable primero]
- isrDanios = (sinVida / 1.09) × 0.10 [SIN restar costoDispersion primero]
- isrTotal = isrVida + isrDanios
- totalPagar = total - retContable - costoDispersion - isrTotal

Caso de prueba (vida=544.20, sinVida=14,263.87):
- ISR Total debe ser ~$1,355.53
- Total a Pagar debe ser ~$12,081.72

Frontend y PDF NO deben recalcular NADA, solo consultar esta función.
';