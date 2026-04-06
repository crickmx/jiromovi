/*
  # Fix: Corregir cálculos fiscales con fórmulas exactas V2

  1. Problema
    - El trigger actual calcula ISR individualmente por cada póliza
    - Las fórmulas de HONORARIOS y RESICO deben aplicarse sobre el TOTAL de comisiones
    - El cálculo individual por póliza no coincide con los documentos de referencia

  2. Solución Temporal
    - Deshabilitar el cálculo automático individual del trigger
    - Los valores se calcularán a nivel de lote usando las fórmulas correctas
    - El trigger solo clasificará VIDA vs NO VIDA (tipo_ramo)

  3. Nuevas Fórmulas (a nivel de lote):
    
    ASIMILADOS:
    - RET CONTABLE = COMISION_EXENTA * 0.16
    - COSTO DISPERSION = COMISION_GRAVADA * 0.09
    - BASE_ISR_EXENTA = COMISION_EXENTA / 1.16
    - ISR_EXENTA = BASE_ISR_EXENTA * 0.10
    - BASE_ISR_GRAVADA = COMISION_GRAVADA / 1.09
    - ISR_GRAVADA = BASE_ISR_GRAVADA * 0.10
    - RET_ISR = ISR_EXENTA + ISR_GRAVADA
    - TOTAL = COMISION_TOTAL - RET_CONTABLE - COSTO_DISPERSION - RET_ISR

    HONORARIOS:
    - IVA = COMISION_GRAVADA * 0.16
    - RET_ISR = COMISION_TOTAL * 0.10
    - RET_IVA = IVA * (2/3)
    - TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA

    RESICO:
    - IVA = COMISION_GRAVADA * 0.16
    - RET_ISR = COMISION_TOTAL * 0.0125
    - RET_IVA = IVA * (2/3)
    - TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
*/

-- ============================================================================
-- PASO 1: Simplificar el trigger para solo clasificar tipo_ramo
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_detail_fiscal_values()
RETURNS TRIGGER AS $$
DECLARE
  v_regimen_fiscal TEXT;
  v_tipo_ramo TEXT;
BEGIN
  -- Obtener régimen fiscal del usuario y normalizar
  SELECT UPPER(TRIM(COALESCE(cfr.name, 'HONORARIOS')))
  INTO v_regimen_fiscal
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE u.id = NEW.usuario_id;

  -- Asegurar que siempre tenga un valor válido
  IF v_regimen_fiscal IS NULL OR v_regimen_fiscal = '' THEN
    v_regimen_fiscal := 'HONORARIOS';
  END IF;

  -- Normalizar variantes comunes
  IF v_regimen_fiscal LIKE '%RESICO%' OR v_regimen_fiscal LIKE '%SIMPLIFICADO%' THEN
    v_regimen_fiscal := 'RESICO';
  ELSIF v_regimen_fiscal LIKE '%ASIMILAD%' THEN
    v_regimen_fiscal := 'ASIMILADOS';
  ELSIF v_regimen_fiscal LIKE '%HONORARIO%' THEN
    v_regimen_fiscal := 'HONORARIOS';
  END IF;

  -- Calcular tipo_ramo desde el campo ramo
  IF UPPER(NEW.ramo) = 'VIDA' THEN
    v_tipo_ramo := 'VIDA';
  ELSE
    v_tipo_ramo := 'DAÑOS';
  END IF;

  -- SOLO guardar régimen y tipo, NO calcular valores fiscales individuales
  NEW.regimen_fiscal := v_regimen_fiscal;
  NEW.tipo_ramo := v_tipo_ramo;
  
  -- Inicializar valores fiscales en 0 (se calcularán a nivel de lote)
  NEW.iva := 0;
  NEW.ret_isr := 0;
  NEW.ret_iva := 0;
  NEW.retencion_contable := 0;
  NEW.costo_dispersion := 0;
  NEW.total_neto := NEW.commission_neta;
  NEW.calculated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_detail_fiscal_values IS
'V2: Clasificación simplificada. Solo determina tipo_ramo (VIDA/DAÑOS) y régimen fiscal.
Los cálculos fiscales se realizan a nivel de lote usando fórmulas exactas por régimen.';

-- ============================================================================
-- PASO 2: Crear nueva función de cálculo fiscal a nivel de lote (V2)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_batch_fiscal_aggregates_v2(p_batch_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_regimen_count integer;
  v_regimen_fiscal text;
  v_commission_vida numeric := 0;      -- COMISION EXENTA
  v_commission_sinvida numeric := 0;   -- COMISION GRAVADA
  v_commission_total numeric := 0;
  v_retencion_contable numeric := 0;
  v_costo_dispersion numeric := 0;
  v_iva numeric := 0;
  v_ret_isr numeric := 0;
  v_ret_iva numeric := 0;
  v_total_neto numeric := 0;
  v_detail_count integer := 0;
  
  -- Variables de cálculo intermedio
  v_base_isr_exenta numeric;
  v_isr_exenta numeric;
  v_base_isr_gravada numeric;
  v_isr_gravada numeric;
BEGIN
  -- Verificar que el batch existe
  IF NOT EXISTS (SELECT 1 FROM commission_batches WHERE id = p_batch_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El lote no existe'
    );
  END IF;

  -- Contar details
  SELECT COUNT(*)
  INTO v_detail_count
  FROM commission_details
  WHERE batch_id = p_batch_id;

  IF v_detail_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El lote no tiene pólizas asociadas'
    );
  END IF;

  -- Sumar comisiones VIDA (exenta) y NO VIDA (gravada)
  SELECT 
    COALESCE(SUM(CASE WHEN UPPER(tipo_ramo) = 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN UPPER(tipo_ramo) != 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(commission_neta), 0)
  INTO 
    v_commission_vida,
    v_commission_sinvida,
    v_commission_total
  FROM commission_details
  WHERE batch_id = p_batch_id;

  -- Determinar régimen fiscal del lote
  SELECT COUNT(DISTINCT regimen_fiscal), MAX(regimen_fiscal)
  INTO v_regimen_count, v_regimen_fiscal
  FROM commission_details
  WHERE batch_id = p_batch_id
    AND regimen_fiscal IS NOT NULL;

  IF v_regimen_count > 1 THEN
    -- Múltiples regímenes - no se puede calcular automáticamente
    v_regimen_fiscal := NULL;
    RETURN jsonb_build_object(
      'success', false,
      'skipped', true,
      'reason', 'El lote contiene múltiples regímenes fiscales'
    );
  END IF;

  -- ========================================================================
  -- CÁLCULOS POR RÉGIMEN FISCAL (FÓRMULAS EXACTAS)
  -- ========================================================================

  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    -- ASIMILADOS
    v_retencion_contable := ROUND(v_commission_vida * 0.16, 2);
    v_costo_dispersion := ROUND(v_commission_sinvida * 0.09, 2);
    v_iva := 0;
    
    -- ISR: Calcular por separado para exenta y gravada
    v_base_isr_exenta := v_commission_vida / 1.16;
    v_isr_exenta := ROUND(v_base_isr_exenta * 0.10, 2);
    
    v_base_isr_gravada := v_commission_sinvida / 1.09;
    v_isr_gravada := ROUND(v_base_isr_gravada * 0.10, 2);
    
    v_ret_isr := ROUND(v_isr_exenta + v_isr_gravada, 2);
    v_ret_iva := 0;
    
    v_total_neto := ROUND(
      v_commission_total - v_retencion_contable - v_costo_dispersion - v_ret_isr,
      2
    );

  ELSIF v_regimen_fiscal = 'HONORARIOS' THEN
    -- HONORARIOS
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    v_iva := ROUND(v_commission_sinvida * 0.16, 2);
    v_ret_isr := ROUND(v_commission_total * 0.10, 2);
    v_ret_iva := ROUND(v_iva * (2.0 / 3.0), 2);
    
    v_total_neto := ROUND(
      v_commission_total + v_iva - v_ret_isr - v_ret_iva,
      2
    );

  ELSIF v_regimen_fiscal = 'RESICO' THEN
    -- RESICO
    v_retencion_contable := 0;
    v_costo_dispersion := 0;
    v_iva := ROUND(v_commission_sinvida * 0.16, 2);
    v_ret_isr := ROUND(v_commission_total * 0.0125, 2);
    v_ret_iva := ROUND(v_iva * (2.0 / 3.0), 2);
    
    v_total_neto := ROUND(
      v_commission_total + v_iva - v_ret_isr - v_ret_iva,
      2
    );

  ELSE
    -- Régimen no reconocido
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Régimen fiscal no reconocido: ' || COALESCE(v_regimen_fiscal, 'NULL')
    );
  END IF;

  -- Actualizar el batch
  UPDATE commission_batches
  SET
    regimen_fiscal = v_regimen_fiscal,
    commission_vida = v_commission_vida,
    commission_sinvida = v_commission_sinvida,
    commission_total = v_commission_total,
    retencion_contable = v_retencion_contable,
    costo_dispersion = v_costo_dispersion,
    iva = v_iva,
    ret_isr = v_ret_isr,
    ret_iva = v_ret_iva,
    total_neto = v_total_neto,
    calculated_at = NOW(),
    tax_version = '2026-v2-exact',
    updated_at = NOW()
  WHERE id = p_batch_id;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'regimen_fiscal', v_regimen_fiscal,
    'commission_vida', v_commission_vida,
    'commission_sinvida', v_commission_sinvida,
    'commission_total', v_commission_total,
    'retencion_contable', v_retencion_contable,
    'costo_dispersion', v_costo_dispersion,
    'iva', v_iva,
    'ret_isr', v_ret_isr,
    'ret_iva', v_ret_iva,
    'total_neto', v_total_neto,
    'detail_count', v_detail_count,
    'tax_version', '2026-v2-exact'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_batch_fiscal_aggregates_v2 IS 
'Calcula valores fiscales a nivel de lote usando fórmulas exactas por régimen.
V2: Implementa las fórmulas exactas de los documentos de referencia para ASIMILADOS, HONORARIOS y RESICO.
Clasificación: VIDA = exenta, NO VIDA = gravada.';

-- ============================================================================
-- PASO 3: Crear alias para compatibilidad con código existente
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_batch_fiscal_aggregates(p_batch_id uuid)
RETURNS jsonb AS $$
BEGIN
  -- Redirigir a la nueva función V2
  RETURN calculate_batch_fiscal_aggregates_v2(p_batch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_batch_fiscal_aggregates IS 
'Alias de compatibilidad. Redirige a calculate_batch_fiscal_aggregates_v2.';
