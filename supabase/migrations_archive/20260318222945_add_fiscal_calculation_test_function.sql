/*
  # Función de prueba para validar cálculos fiscales

  Esta función permite probar los cálculos fiscales con valores específicos
  para verificar que las fórmulas sean correctas.

  Ejemplo de uso:
  SELECT test_fiscal_calculation('HONORARIOS', 10000, 5000);
  SELECT test_fiscal_calculation('RESICO', 10000, 5000);
*/

CREATE OR REPLACE FUNCTION test_fiscal_calculation(
  p_regimen_fiscal TEXT,
  p_commission_vida NUMERIC,
  p_commission_sinvida NUMERIC
)
RETURNS TABLE(
  concepto TEXT,
  valor NUMERIC,
  formula TEXT
) AS $$
DECLARE
  v_commission_total NUMERIC;
  v_iva NUMERIC;
  v_subtotal_con_iva NUMERIC;
  v_ret_isr NUMERIC;
  v_ret_iva NUMERIC;
  v_total_neto NUMERIC;
  v_regimen TEXT;
BEGIN
  v_regimen := UPPER(p_regimen_fiscal);
  v_commission_total := p_commission_vida + p_commission_sinvida;

  IF v_regimen = 'HONORARIOS' THEN
    -- HONORARIOS
    v_iva := p_commission_sinvida * 0.16;
    v_subtotal_con_iva := v_commission_total + v_iva;
    v_ret_isr := v_subtotal_con_iva * 0.10;
    v_ret_iva := v_iva * (2.0 / 3.0);
    v_total_neto := v_subtotal_con_iva - v_ret_isr - v_ret_iva;

    RETURN QUERY
    SELECT 'Commission Vida'::TEXT, ROUND(p_commission_vida, 2), ''::TEXT
    UNION ALL
    SELECT 'Commission Sin Vida'::TEXT, ROUND(p_commission_sinvida, 2), ''::TEXT
    UNION ALL
    SELECT 'Commission Total'::TEXT, ROUND(v_commission_total, 2), 'Vida + Sin Vida'::TEXT
    UNION ALL
    SELECT 'IVA (16%)'::TEXT, ROUND(v_iva, 2), 'Sin Vida × 0.16'::TEXT
    UNION ALL
    SELECT 'Subtotal con IVA'::TEXT, ROUND(v_subtotal_con_iva, 2), 'Total + IVA'::TEXT
    UNION ALL
    SELECT 'Ret ISR (10%)'::TEXT, ROUND(v_ret_isr, 2), '(Total + IVA) × 0.10'::TEXT
    UNION ALL
    SELECT 'Ret IVA (2/3)'::TEXT, ROUND(v_ret_iva, 2), 'IVA × (2/3)'::TEXT
    UNION ALL
    SELECT '=== TOTAL NETO ==='::TEXT, ROUND(v_total_neto, 2), 'Subtotal - Ret ISR - Ret IVA'::TEXT;

  ELSIF v_regimen = 'RESICO' THEN
    -- RESICO
    v_iva := p_commission_sinvida * 0.16;
    v_subtotal_con_iva := v_commission_total + v_iva;
    v_ret_isr := v_subtotal_con_iva * 0.0125;
    v_ret_iva := v_iva * (2.0 / 3.0);
    v_total_neto := v_subtotal_con_iva - v_ret_isr - v_ret_iva;

    RETURN QUERY
    SELECT 'Commission Vida'::TEXT, ROUND(p_commission_vida, 2), ''::TEXT
    UNION ALL
    SELECT 'Commission Sin Vida'::TEXT, ROUND(p_commission_sinvida, 2), ''::TEXT
    UNION ALL
    SELECT 'Commission Total'::TEXT, ROUND(v_commission_total, 2), 'Vida + Sin Vida'::TEXT
    UNION ALL
    SELECT 'IVA (16%)'::TEXT, ROUND(v_iva, 2), 'Sin Vida × 0.16'::TEXT
    UNION ALL
    SELECT 'Subtotal con IVA'::TEXT, ROUND(v_subtotal_con_iva, 2), 'Total + IVA'::TEXT
    UNION ALL
    SELECT 'Ret ISR (1.25%)'::TEXT, ROUND(v_ret_isr, 2), '(Total + IVA) × 0.0125'::TEXT
    UNION ALL
    SELECT 'Ret IVA (2/3)'::TEXT, ROUND(v_ret_iva, 2), 'IVA × (2/3)'::TEXT
    UNION ALL
    SELECT '=== TOTAL NETO ==='::TEXT, ROUND(v_total_neto, 2), 'Subtotal - Ret ISR - Ret IVA'::TEXT;

  ELSE
    RETURN QUERY
    SELECT 'ERROR'::TEXT, 0::NUMERIC, 'Régimen no reconocido'::TEXT;
  END IF;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION test_fiscal_calculation IS 
'Función de prueba para validar cálculos fiscales de HONORARIOS y RESICO.
Ejemplo: SELECT * FROM test_fiscal_calculation(''HONORARIOS'', 10000, 5000);';
