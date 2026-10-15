/*
  # FIX DEFINITIVO: ASIMILADOS SIN división /1.09

  ## Análisis del problema:
  El usuario pide ELIMINAR completamente cualquier uso de /1.09.
  La fórmula correcta es más simple: solo separar Vida/Sin Vida y aplicar 10% directo.

  ## Fórmulas CORRECTAS (según especificaciones del usuario):
  - vida = suma(comisión donde ramo == "Vida")
  - sinVida = suma(comisión donde ramo != "Vida")
  - retContable = vida × 0.16
  - dispersion = sinVida × 0.09
  - isrVida = (vida - retContable) × 0.10  [SIN /1.09]
  - isrDanios = (sinVida - dispersion) × 0.10  [SIN /1.09]
  - isrTotal = isrVida + isrDanios
  - totalPagar = (vida + sinVida) - retContable - dispersion - isrTotal
  - IVA = 0

  Con estas fórmulas:
  - vida = 544.20
  - sinVida = 14,263.87
  - retContable = 87.07
  - dispersion = 1,283.75
  - isrVida = (544.20 - 87.07) * 0.10 = 45.71
  - isrDanios = (14,263.87 - 1,283.75) * 0.10 = 1,298.01
  - isrTotal = 45.71 + 1,298.01 = 1,343.72
  - totalPagar = 14,808.07 - 87.07 - 1,283.75 - 1,343.72 = 12,093.53
*/

-- ============================================
-- REEMPLAZAR FUNCIÓN DE CÁLCULO
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
  -- PASO 2: APLICAR FÓRMULAS FISCALES SIN /1.09
  -- ============================================

  -- Retención Contable (SOLO VIDA)
  v_ret_contable := ROUND((v_vida * 0.16)::numeric, 2);

  -- Costo de Dispersión (SOLO SIN VIDA)
  v_dispersion := ROUND((v_sin_vida * 0.09)::numeric, 2);

  -- ISR VIDA (SIN división /1.09)
  v_isr_vida := ROUND(((v_vida - v_ret_contable) * 0.10)::numeric, 2);

  -- ISR DAÑOS (SIN división /1.09)
  v_isr_danios := ROUND(((v_sin_vida - v_dispersion) * 0.10)::numeric, 2);

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

COMMENT ON FUNCTION calcular_desglose_fiscal_asimilados IS
'Función consolidada para calcular el desglose fiscal de ASIMILADOS SIN división /1.09.
Fórmulas: isrVida = (vida - retContable) * 0.10, isrDanios = (sinVida - dispersion) * 0.10.
Esta es la ÚNICA fuente de verdad. Frontend y PDF deben consultar esta función y NO recalcular.';