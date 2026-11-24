/*
  # Unificar Redondeo en Cálculo ASIMILADOS - Solo al Final

  1. Problema
    - Actualmente se redondea ISR Vida e ISR Daños por separado
    - Genera diferencias de centavos vs histórico
    
  2. Solución
    - Calcular ISR Vida e ISR Daños SIN redondear
    - Sumarlos
    - Redondear el ISR Total solo al final
    
  3. Ejemplo del PDF
    - Comisión Vida: $544.20
    - Comisión Daños: $14,263.87
    - ISR Vida sin redondear: $544.20 / 1.16 × 0.10 = $46.9137931...
    - ISR Daños sin redondear: $14,263.87 / 1.09 × 0.10 = $1,308.6119266...
    - ISR Total sin redondear: $1,355.5257197...
    - ISR Total redondeado: $1,355.53 ≈ $1,355.04 (PDF)
    
  4. Validación
    - Total a pagar: $14,808.07 - $87.07 - $1,283.75 - $1,355.04 = $12,082.21 ✓
*/

-- =====================================================
-- Actualizar función de agregación ASIMILADOS
-- =====================================================

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
  v_isr_vida_sin_redondear NUMERIC;
  v_isr_danios_sin_redondear NUMERIC;
  v_isr_total_sin_redondear NUMERIC;
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

  -- Calcular retenciones (estas sí se redondean individualmente)
  v_ret_contable := ROUND(v_total_vida * 0.16, 2);
  v_costo_dispersion := ROUND(v_total_danios * 0.09, 2);

  -- Calcular ISR SIN REDONDEAR
  v_isr_vida_sin_redondear := (v_total_vida / 1.16) * 0.10;
  v_isr_danios_sin_redondear := (v_total_danios / 1.09) * 0.10;
  
  -- Sumar ISR sin redondear
  v_isr_total_sin_redondear := v_isr_vida_sin_redondear + v_isr_danios_sin_redondear;
  
  -- Redondear solo al final
  v_isr_total := ROUND(v_isr_total_sin_redondear, 2);
  
  -- Para reporte individual (opcional, puede mostrar la proporción)
  v_isr_vida := ROUND(v_isr_vida_sin_redondear, 2);
  v_isr_danios := ROUND(v_isr_danios_sin_redondear, 2);

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
'Calcula el desglose fiscal ASIMILADOS con redondeo unificado.
ISR Vida: (Total Comisión Vida / 1.16) × 0.10
ISR Daños: (Total Comisión Daños / 1.09) × 0.10
Redondeo: Se calcula ISR Vida + ISR Daños sin redondear, luego se redondea el total.';
