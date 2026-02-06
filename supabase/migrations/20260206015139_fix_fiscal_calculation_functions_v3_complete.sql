/*
  # Corregir funciones de cálculo fiscal - limpieza completa

  1. Problema
    - Existen múltiples versiones de las funciones con diferentes firmas
    - Algunas usan agent_id (obsoleto), otras usuario_id
    
  2. Solución
    - DROP de todas las versiones existentes
    - Crear versiones limpias que solo usan usuarios
*/

-- =============================================
-- DROP todas las versiones de funciones fiscales
-- =============================================

DROP FUNCTION IF EXISTS calcular_desglose_fiscal_asimilados(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS calcular_desglose_fiscal_asimilados(UUID) CASCADE;
DROP FUNCTION IF EXISTS calcular_desglose_fiscal_general(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calcular_desglose_fiscal_general(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_batch_fiscal_aggregates(UUID) CASCADE;

-- =============================================
-- FUNCIÓN 1: calcular_desglose_fiscal_asimilados (solo batch_id)
-- =============================================

CREATE OR REPLACE FUNCTION calcular_desglose_fiscal_asimilados(
  p_batch_id UUID
)
RETURNS TABLE(
  usuario_id UUID,
  usuario_nombre TEXT,
  regimen_fiscal TEXT,
  total_comision_neta NUMERIC,
  total_isr_retenido NUMERIC,
  total_iva_retenido NUMERIC,
  total_costo_dispersion NUMERIC,
  total_importe_a_pagar NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as usuario_id,
    u.nombre_completo as usuario_nombre,
    COALESCE(cfr.name, 'ASIMILADOS') as regimen_fiscal,
    SUM(cd.commission_neta)::NUMERIC as total_comision_neta,
    SUM(cd.isr)::NUMERIC as total_isr_retenido,
    SUM(cd.iva_retenido)::NUMERIC as total_iva_retenido,
    SUM(cd.costo_dispersion)::NUMERIC as total_costo_dispersion,
    SUM(cd.importe_pago)::NUMERIC as total_importe_a_pagar
  FROM commission_details cd
  INNER JOIN usuarios u ON u.id = cd.usuario_id
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE cd.batch_id = p_batch_id
    AND COALESCE(cfr.name, 'ASIMILADOS') = 'ASIMILADOS'
  GROUP BY u.id, u.nombre_completo, cfr.name
  ORDER BY u.nombre_completo;
END;
$$;

-- =============================================
-- FUNCIÓN 2: calcular_desglose_fiscal_general
-- =============================================

CREATE OR REPLACE FUNCTION calcular_desglose_fiscal_general(
  p_batch_id UUID,
  p_regimen_fiscal TEXT DEFAULT NULL
)
RETURNS TABLE(
  usuario_id UUID,
  usuario_nombre TEXT,
  regimen_fiscal TEXT,
  total_comision_bruta NUMERIC,
  total_comision_neta NUMERIC,
  total_iva_trasladado NUMERIC,
  total_iva_retenido NUMERIC,
  total_isr NUMERIC,
  total_importe_a_pagar NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as usuario_id,
    u.nombre_completo as usuario_nombre,
    COALESCE(cfr.name, 'HONORARIOS') as regimen_fiscal,
    SUM(cd.commission_bruta)::NUMERIC as total_comision_bruta,
    SUM(cd.commission_neta)::NUMERIC as total_comision_neta,
    SUM(cd.iva_trasladado)::NUMERIC as total_iva_trasladado,
    SUM(cd.iva_retenido)::NUMERIC as total_iva_retenido,
    SUM(cd.isr)::NUMERIC as total_isr,
    SUM(cd.importe_pago)::NUMERIC as total_importe_a_pagar
  FROM commission_details cd
  INNER JOIN usuarios u ON u.id = cd.usuario_id
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE cd.batch_id = p_batch_id
    AND (p_regimen_fiscal IS NULL OR COALESCE(cfr.name, 'HONORARIOS') = p_regimen_fiscal)
  GROUP BY u.id, u.nombre_completo, cfr.name
  ORDER BY u.nombre_completo;
END;
$$;

-- =============================================
-- FUNCIÓN 3: calculate_batch_fiscal_aggregates
-- =============================================

CREATE OR REPLACE FUNCTION calculate_batch_fiscal_aggregates(p_batch_id UUID)
RETURNS TABLE(
  total_honorarios_importe_pago NUMERIC,
  total_resico_importe_pago NUMERIC,
  total_asimilados_importe_pago NUMERIC,
  count_honorarios BIGINT,
  count_resico BIGINT,
  count_asimilados BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    SUM(CASE WHEN COALESCE(cfr.name, 'HONORARIOS') = 'HONORARIOS' THEN cd.importe_pago ELSE 0 END)::NUMERIC as total_honorarios_importe_pago,
    SUM(CASE WHEN cfr.name = 'RESICO' THEN cd.importe_pago ELSE 0 END)::NUMERIC as total_resico_importe_pago,
    SUM(CASE WHEN cfr.name = 'ASIMILADOS' THEN cd.importe_pago ELSE 0 END)::NUMERIC as total_asimilados_importe_pago,
    COUNT(CASE WHEN COALESCE(cfr.name, 'HONORARIOS') = 'HONORARIOS' THEN 1 END) as count_honorarios,
    COUNT(CASE WHEN cfr.name = 'RESICO' THEN 1 END) as count_resico,
    COUNT(CASE WHEN cfr.name = 'ASIMILADOS' THEN 1 END) as count_asimilados
  FROM commission_details cd
  INNER JOIN usuarios u ON u.id = cd.usuario_id
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE cd.batch_id = p_batch_id;
END;
$$;

COMMENT ON FUNCTION calcular_desglose_fiscal_asimilados IS 'Calcula desglose fiscal para régimen ASIMILADOS - solo usa usuarios, sin commission_agents';
COMMENT ON FUNCTION calcular_desglose_fiscal_general IS 'Calcula desglose fiscal general - solo usa usuarios, sin commission_agents';
COMMENT ON FUNCTION calculate_batch_fiscal_aggregates IS 'Calcula agregados fiscales de un lote - solo usa usuarios, sin commission_agents';
