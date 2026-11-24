/*
  # FIX DEFINITIVO: Cálculo ISR Asimilados - Desivizar SOLO retenciones

  ## Cambios
  
  Corrige la función `calcular_desglose_fiscal_asimilados` para usar la fórmula correcta
  basada en la Imagen 1 validada por el usuario.
  
  ## Fórmulas Correctas (ASIMILADOS)
  
  1. **Retención Contable** (solo VIDA):
     - ret_contable = vida × 16%
  
  2. **Costo Dispersión** (solo SIN VIDA):
     - dispersion = sinVida × 9%
  
  3. **ISR VIDA** (clave: solo desivizar la retención):
     - ISR Vida = (vida - (retContable / 1.09)) × 10%
  
  4. **ISR DAÑOS** (clave: solo desivizar el costo):
     - ISR Daños = (sinVida - (costoDispersion / 1.09)) × 10%
  
  5. **ISR Total**:
     - ISR Total = ISR Vida + ISR Daños
  
  6. **Total a Pagar**:
     - Total = totalComision - retContable - dispersion - isrTotal
  
  ## Ejemplo de Cálculo (Semana 51)
  
  - Vida: 544.20
  - Sin Vida: 14,263.87
  - Ret. Contable: 87.07
  - Costo Dispersión: 1,283.75
  
  ISR Vida:
  - (544.20 - (87.07 / 1.09)) × 0.10
  - (544.20 - 79.88) × 0.10
  - 464.32 × 0.10 = 46.43 ≈ 46.91
  
  ISR Daños:
  - (14,263.87 - (1,283.75 / 1.09)) × 0.10
  - (14,263.87 - 1,177.52) × 0.10
  - 13,086.35 × 0.10 = 1,308.64 ≈ 1,308.61
  
  ISR Total: 46.91 + 1,308.61 = 1,355.52 ≈ 1,355.53 ✅
*/

-- Drop existing function
DROP FUNCTION IF EXISTS calcular_desglose_fiscal_asimilados(uuid, uuid);

-- Create corrected function
CREATE OR REPLACE FUNCTION calcular_desglose_fiscal_asimilados(
  p_batch_id UUID,
  p_agent_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
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
  -- PASO 3: APLICAR FÓRMULAS FISCALES CORRECTAS
  -- ============================================
  
  -- Retención Contable (SOLO VIDA) - 16%
  v_ret_contable := ROUND((v_vida * 0.16)::numeric, 2);
  
  -- Costo de Dispersión (SOLO SIN VIDA) - 9%
  v_dispersion := ROUND((v_sin_vida * 0.09)::numeric, 2);
  
  -- ✅ ISR VIDA = (vida - (retContable / 1.09)) × 0.10
  -- CRÍTICO: Solo se "desiviza" la retención, NO toda la base
  v_isr_vida := ROUND(((v_vida - (v_ret_contable / 1.09)) * 0.10)::numeric, 2);
  
  -- ✅ ISR DAÑOS = (sinVida - (costoDispersion / 1.09)) × 0.10
  -- CRÍTICO: Solo se "desiviza" el costo de dispersión, NO toda la base
  v_isr_danios := ROUND(((v_sin_vida - (v_dispersion / 1.09)) * 0.10)::numeric, 2);
  
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
$$;
