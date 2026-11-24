/*
  # FIX DEFINITIVO: Cálculo ASIMILADOS sin Recálculo en Frontend

  ## Problema Identificado:
  El trigger actual calcula por fila individual, pero las fórmulas fiscales ASIMILADOS
  requieren PRIMERO sumar todas las comisiones por Vida/Sin Vida, y LUEGO aplicar
  las fórmulas fiscales globales.

  ## Solución:
  Crear una función consolidada que:
  1. Suma todas las comisiones Vida para el agente
  2. Suma todas las comisiones Sin Vida para el agente
  3. Aplica las fórmulas fiscales correctas con división /1.09
  4. Retorna el desglose fiscal completo como JSON

  ## Fórmulas Correctas ASIMILADOS:
  - vida = suma(comisión donde ramo == "Vida")
  - sinVida = suma(comisión donde ramo != "Vida")
  - retContable = vida × 0.16
  - dispersion = sinVida × 0.09
  - baseISRVida = (vida - retContable) / 1.09
  - isrVida = baseISRVida × 0.10
  - baseISRDanios = (sinVida - dispersion) / 1.09
  - isrDanios = baseISRDanios × 0.10
  - isrTotal = isrVida + isrDanios
  - totalPagar = (vida + sinVida) - retContable - dispersion - isrTotal
  - IVA = 0

  ## Frontend y PDF:
  - NO deben recalcular NADA
  - Solo consultar esta función y mostrar valores
*/

-- ============================================
-- FUNCIÓN CONSOLIDADA: CÁLCULO FISCAL ASIMILADOS
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
  v_isr_vida NUMERIC := 0;
  v_base_isr_danios NUMERIC := 0;
  v_isr_danios NUMERIC := 0;
  v_isr_total NUMERIC := 0;
  v_total_pagar NUMERIC := 0;
  v_result JSON;
BEGIN
  -- Obtener régimen fiscal del agente
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
  -- PASO 1: SUMAR COMISIONES POR VIDA Y SIN VIDA
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
  -- PASO 2: APLICAR FÓRMULAS FISCALES
  -- ============================================

  -- Retención Contable (SOLO VIDA)
  v_ret_contable := ROUND((v_vida * 0.16)::numeric, 2);

  -- Costo de Dispersión (SOLO SIN VIDA)
  v_dispersion := ROUND((v_sin_vida * 0.09)::numeric, 2);

  -- ISR VIDA
  v_base_isr_vida := ROUND(((v_vida - v_ret_contable) / 1.09)::numeric, 2);
  v_isr_vida := ROUND((v_base_isr_vida * 0.10)::numeric, 2);

  -- ISR DAÑOS (SIN VIDA)
  v_base_isr_danios := ROUND(((v_sin_vida - v_dispersion) / 1.09)::numeric, 2);
  v_isr_danios := ROUND((v_base_isr_danios * 0.10)::numeric, 2);

  -- ISR TOTAL
  v_isr_total := ROUND((v_isr_vida + v_isr_danios)::numeric, 2);

  -- TOTAL A PAGAR
  v_total_pagar := ROUND((v_total_comision - v_ret_contable - v_dispersion - v_isr_total)::numeric, 2);

  -- ============================================
  -- RETORNAR RESULTADO COMO JSON
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
-- FUNCIÓN AUXILIAR: VALIDAR DESGLOSE FISCAL
-- ============================================

CREATE OR REPLACE FUNCTION validar_desglose_fiscal_asimilados(
  p_batch_id UUID,
  p_agent_id UUID
)
RETURNS TABLE(
  campo TEXT,
  esperado NUMERIC,
  calculado NUMERIC,
  diferencia NUMERIC,
  valido BOOLEAN
) AS $$
DECLARE
  v_desglose JSON;
BEGIN
  -- Obtener desglose calculado
  v_desglose := calcular_desglose_fiscal_asimilados(p_batch_id, p_agent_id);

  -- Validar totales
  RETURN QUERY
  SELECT 
    'Total Comisión'::TEXT,
    (v_desglose->>'vida')::numeric + (v_desglose->>'sin_vida')::numeric,
    (v_desglose->>'total_comision')::numeric,
    ABS((v_desglose->>'vida')::numeric + (v_desglose->>'sin_vida')::numeric - (v_desglose->>'total_comision')::numeric),
    ABS((v_desglose->>'vida')::numeric + (v_desglose->>'sin_vida')::numeric - (v_desglose->>'total_comision')::numeric) < 0.01
  
  UNION ALL
  
  SELECT 
    'Total a Pagar'::TEXT,
    (v_desglose->>'total_comision')::numeric - (v_desglose->>'ret_contable')::numeric - (v_desglose->>'dispersion')::numeric - (v_desglose->>'isr_total')::numeric,
    (v_desglose->>'total_pagar')::numeric,
    ABS((v_desglose->>'total_comision')::numeric - (v_desglose->>'ret_contable')::numeric - (v_desglose->>'dispersion')::numeric - (v_desglose->>'isr_total')::numeric - (v_desglose->>'total_pagar')::numeric),
    ABS((v_desglose->>'total_comision')::numeric - (v_desglose->>'ret_contable')::numeric - (v_desglose->>'dispersion')::numeric - (v_desglose->>'isr_total')::numeric - (v_desglose->>'total_pagar')::numeric) < 0.01;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- ÍNDICES PARA OPTIMIZAR CONSULTAS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_commission_details_batch_agent 
  ON commission_details(batch_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_commission_details_ramo 
  ON commission_details(LOWER(ramo));

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON FUNCTION calcular_desglose_fiscal_asimilados IS 
'Función consolidada para calcular el desglose fiscal de ASIMILADOS.
Esta es la ÚNICA fuente de verdad. Frontend y PDF deben consultar esta función
y NO recalcular nada. Aplica las fórmulas fiscales correctas con división /1.09.';

COMMENT ON FUNCTION validar_desglose_fiscal_asimilados IS
'Función auxiliar para validar que los cálculos fiscales sean consistentes.
Útil para debugging y QA.';