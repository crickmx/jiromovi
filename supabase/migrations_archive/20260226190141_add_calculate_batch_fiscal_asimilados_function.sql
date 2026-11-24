/*
  # Agregar función para calcular desglose fiscal ASIMILADOS a nivel de lote

  1. Problema
    - El cálculo por póliza individual causa diferencias de redondeo
    - El PDF debe mostrar valores calculados sobre TOTALES agregados
  
  2. Solución
    - Crear función que calcula el desglose fiscal sobre totales agregados
    - Usar esta función en el PDF en lugar de sumar valores individuales
    
  3. Fórmulas (sobre totales agregados)
    - Total Vida = SUM(commission_neta WHERE tipo_ramo = 'VIDA')
    - Total Daños = SUM(commission_neta WHERE tipo_ramo = 'DAÑOS')
    - Ret. Contable = Total Vida × 0.16
    - Costo Dispersión = Total Daños × 0.09
    - Base ISR Vida = (Total Vida - Ret. Contable) / 1.09
    - ISR Vida = Base ISR Vida × 0.10
    - Base ISR Daños = (Total Daños - Costo Dispersión) / 1.09
    - ISR Daños = Base ISR Daños × 0.10
    - ISR Total = ISR Vida + ISR Daños
    - Total a Pagar = (Total Vida + Total Daños) - Ret. Contable - Costo Dispersión - ISR Total
*/

CREATE OR REPLACE FUNCTION calculate_batch_asimilados_fiscal(
  p_batch_id UUID,
  p_usuario_id UUID
)
RETURNS TABLE(
  vida NUMERIC,
  danios NUMERIC,
  ret_contable NUMERIC,
  costo_dispersion NUMERIC,
  isr_vida NUMERIC,
  isr_danios NUMERIC,
  isr_total NUMERIC,
  total_a_pagar NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total_vida NUMERIC := 0;
  v_total_danios NUMERIC := 0;
  v_ret_contable NUMERIC;
  v_costo_dispersion NUMERIC;
  v_base_isr_vida NUMERIC;
  v_base_isr_danios NUMERIC;
  v_isr_vida NUMERIC;
  v_isr_danios NUMERIC;
  v_isr_total NUMERIC;
  v_total_pagar NUMERIC;
BEGIN
  -- Sumar totales por tipo de ramo
  SELECT 
    COALESCE(SUM(CASE WHEN tipo_ramo = 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_ramo = 'DAÑOS' THEN commission_neta ELSE 0 END), 0)
  INTO v_total_vida, v_total_danios
  FROM commission_details
  WHERE batch_id = p_batch_id
    AND usuario_id = p_usuario_id
    AND regimen_fiscal = 'ASIMILADOS';

  -- Calcular retenciones
  v_ret_contable := ROUND(v_total_vida * 0.16, 2);
  v_costo_dispersion := ROUND(v_total_danios * 0.09, 2);

  -- Calcular ISR Vida
  v_base_isr_vida := (v_total_vida - v_ret_contable) / 1.09;
  v_isr_vida := ROUND(v_base_isr_vida * 0.10, 2);

  -- Calcular ISR Daños
  v_base_isr_danios := (v_total_danios - v_costo_dispersion) / 1.09;
  v_isr_danios := ROUND(v_base_isr_danios * 0.10, 2);

  -- ISR Total
  v_isr_total := v_isr_vida + v_isr_danios;

  -- Total a pagar
  v_total_pagar := ROUND((v_total_vida + v_total_danios) - v_ret_contable - v_costo_dispersion - v_isr_total, 2);

  RETURN QUERY SELECT
    v_total_vida,
    v_total_danios,
    v_ret_contable,
    v_costo_dispersion,
    v_isr_vida,
    v_isr_danios,
    v_isr_total,
    v_total_pagar;
END;
$$;

COMMENT ON FUNCTION calculate_batch_asimilados_fiscal IS
'Calcula el desglose fiscal ASIMILADOS sobre totales agregados de un lote para un usuario específico.
Esto evita diferencias de redondeo al calcular sobre pólizas individuales.
Usar esta función para generar PDFs en lugar de sumar valores individuales.';
