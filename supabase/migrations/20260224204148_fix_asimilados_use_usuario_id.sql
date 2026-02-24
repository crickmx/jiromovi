/*
  # Fix calcular_desglose_fiscal_asimilados to use usuario_id

  1. Changes
    - Drop old function with agent_id
    - Create new function using usuario_id directly
    - Remove references to commission_agents table (deprecated)
    - Use usuarios.regimen_fiscal directly

  2. Security
    - Maintain STABLE function characteristics
    - Keep same return format for compatibility
*/

-- Drop old function
DROP FUNCTION IF EXISTS calcular_desglose_fiscal_asimilados(uuid, uuid);
DROP FUNCTION IF EXISTS calcular_desglose_fiscal_asimilados(uuid);

-- Create new function using usuario_id
CREATE OR REPLACE FUNCTION calcular_desglose_fiscal_asimilados(
  p_batch_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_usuario_id UUID;
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
  -- PASO 1: OBTENER USUARIO Y RÉGIMEN FISCAL
  -- ============================================

  -- Get the first usuario_id from batch details
  SELECT DISTINCT cd.usuario_id
  INTO v_usuario_id
  FROM commission_details cd
  WHERE cd.batch_id = p_batch_id
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RETURN json_build_object(
      'error', 'No se encontró usuario en el lote',
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

  -- Get regimen fiscal from usuarios
  SELECT UPPER(COALESCE(cfr.name, 'HONORARIOS'))
  INTO v_regimen_fiscal
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE u.id = v_usuario_id;

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
    AND cd.usuario_id = v_usuario_id;

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

  -- ISR VIDA = (vida - (retContable / 1.09)) × 0.10
  v_isr_vida := ROUND(((v_vida - (v_ret_contable / 1.09)) * 0.10)::numeric, 2);

  -- ISR DAÑOS = (sinVida - (costoDispersion / 1.09)) × 0.10
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

COMMENT ON FUNCTION calcular_desglose_fiscal_asimilados IS
  'Calcula el desglose fiscal para régimen ASIMILADOS usando solo batch_id. Obtiene el usuario_id del lote automáticamente.';
