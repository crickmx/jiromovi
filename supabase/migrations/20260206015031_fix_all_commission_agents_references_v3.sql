/*
  # Corregir todas las referencias a commission_agents

  1. Problema
    - Múltiples funciones de base de datos todavía referencian commission_agents
    - La tabla fue eliminada pero las funciones no se actualizaron
    
  2. Solución
    - Actualizar todas las funciones para usar usuarios en lugar de commission_agents
    - Reemplazar ca.id con u.id (usuario_id)
    - Reemplazar ca.fiscal_regime_id con u.regimen_fiscal_id
*/

-- =============================================
-- DROP funciones existentes que cambian estructura
-- =============================================

DROP FUNCTION IF EXISTS get_available_commission_batches_for_user CASCADE;

-- =============================================
-- FUNCIÓN 1: recalculate_commission_batch_fiscal
-- =============================================

CREATE OR REPLACE FUNCTION recalculate_commission_batch_fiscal(
  p_batch_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  total_records_updated INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
  v_updated_count INTEGER := 0;
  v_regimen_fiscal TEXT;
BEGIN
  FOR v_record IN 
    SELECT 
      cd.id,
      cd.usuario_id,
      cd.commission_bruta,
      cd.commission_neta,
      COALESCE(cfr.name, 'HONORARIOS') as regimen_fiscal
    FROM commission_details cd
    INNER JOIN usuarios u ON u.id = cd.usuario_id
    LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
    WHERE cd.batch_id = p_batch_id
  LOOP
    v_regimen_fiscal := v_record.regimen_fiscal;
    
    IF v_regimen_fiscal = 'ASIMILADOS' THEN
      UPDATE commission_details
      SET
        isr = ROUND((commission_neta / 1.09) * 0.10, 2),
        iva_retenido = 0,
        costo_dispersion = ROUND((commission_neta / 1.09) * 0.09, 2),
        importe_pago = commission_neta - ROUND((commission_neta / 1.09) * 0.10, 2) - ROUND((commission_neta / 1.09) * 0.09, 2)
      WHERE id = v_record.id;
      
    ELSIF v_regimen_fiscal = 'RESICO' THEN
      UPDATE commission_details
      SET
        iva_trasladado = ROUND(commission_bruta * 0.16, 2),
        iva_retenido = ROUND((commission_bruta + ROUND(commission_bruta * 0.16, 2)) * 0.0533, 2),
        isr = ROUND((commission_bruta + ROUND(commission_bruta * 0.16, 2)) * 0.0125, 2),
        costo_dispersion = 0,
        importe_pago = (commission_bruta + ROUND(commission_bruta * 0.16, 2)) - ROUND((commission_bruta + ROUND(commission_bruta * 0.16, 2)) * 0.0533, 2) - ROUND((commission_bruta + ROUND(commission_bruta * 0.16, 2)) * 0.0125, 2)
      WHERE id = v_record.id;
      
    ELSE -- HONORARIOS
      UPDATE commission_details
      SET
        iva_trasladado = ROUND(commission_bruta * 0.16, 2),
        iva_retenido = ROUND((commission_bruta + ROUND(commission_bruta * 0.16, 2)) * 0.0533, 2),
        isr = ROUND((commission_bruta + ROUND(commission_bruta * 0.16, 2)) * 0.10, 2),
        costo_dispersion = 0,
        importe_pago = (commission_bruta + ROUND(commission_bruta * 0.16, 2)) - ROUND((commission_bruta + ROUND(commission_bruta * 0.16, 2)) * 0.0533, 2) - ROUND((commission_bruta + ROUND(commission_bruta * 0.16, 2)) * 0.10, 2)
      WHERE id = v_record.id;
    END IF;
    
    v_updated_count := v_updated_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT TRUE, 'Recalculo completado exitosamente'::TEXT, v_updated_count;
END;
$$;

-- =============================================
-- FUNCIÓN 2: apply_vendor_mappings_to_commission_details
-- =============================================

CREATE OR REPLACE FUNCTION apply_vendor_mappings_to_commission_details(batch_id_param UUID)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  mapping_result RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR mapping_result IN
    SELECT 
      vm.vendor_name_normalized,
      vm.movi_user_id,
      vm.id as mapping_id
    FROM vendor_mappings vm
    WHERE vm.is_active = TRUE
  LOOP
    UPDATE commission_details cd
    SET 
      usuario_id = mapping_result.movi_user_id,
      vendor_mapping_id = mapping_result.mapping_id,
      updated_at = NOW()
    WHERE cd.batch_id = batch_id_param
      AND normalize_vendor_name(cd.vendor_name) = mapping_result.vendor_name_normalized
      AND cd.usuario_id IS NULL;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT TRUE, format('Se aplicaron %s mapeos de vendedores', updated_count);
END;
$$;

-- =============================================
-- FUNCIÓN 3: assign_vendor_manually_to_commission_detail
-- =============================================

CREATE OR REPLACE FUNCTION assign_vendor_manually_to_commission_detail(
  detail_id_param UUID,
  movi_user_id_param UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  vendor_name_val TEXT;
  mapping_id_val UUID;
BEGIN
  SELECT vendor_name INTO vendor_name_val
  FROM commission_details
  WHERE id = detail_id_param;
  
  IF vendor_name_val IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Detalle de comisión no encontrado'::TEXT;
    RETURN;
  END IF;
  
  INSERT INTO vendor_mappings (vendor_name_normalized, movi_user_id, is_active)
  VALUES (normalize_vendor_name(vendor_name_val), movi_user_id_param, TRUE)
  ON CONFLICT (vendor_name_normalized) 
  DO UPDATE SET 
    movi_user_id = movi_user_id_param,
    is_active = TRUE,
    updated_at = NOW()
  RETURNING id INTO mapping_id_val;
  
  UPDATE commission_details
  SET 
    usuario_id = movi_user_id_param,
    vendor_mapping_id = mapping_id_val,
    updated_at = NOW()
  WHERE id = detail_id_param;
  
  RETURN QUERY SELECT TRUE, 'Vendedor asignado correctamente'::TEXT;
END;
$$;

-- =============================================
-- FUNCIÓN 4: get_available_commission_batches_for_user
-- =============================================

CREATE OR REPLACE FUNCTION get_available_commission_batches_for_user(p_user_id UUID)
RETURNS TABLE(
  batch_id UUID,
  batch_name TEXT,
  date_from DATE,
  date_to DATE,
  status TEXT,
  total_records BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cb.id as batch_id,
    cb.name as batch_name,
    cb.date_from,
    cb.date_to,
    cb.status,
    COUNT(cd2.id) as total_records
  FROM commission_batches cb
  INNER JOIN commission_details cd2 ON cd2.batch_id = cb.id
  INNER JOIN usuarios u ON u.id = cd2.usuario_id
  WHERE u.id = p_user_id
    AND cb.status IN ('confirmed', 'closed')
  GROUP BY cb.id, cb.name, cb.date_from, cb.date_to, cb.status
  ORDER BY cb.date_from DESC;
END;
$$;

-- =============================================
-- Limpiar índices obsoletos
-- =============================================

DROP INDEX IF EXISTS idx_commission_agents_fiscal_regime_id;
DROP INDEX IF EXISTS idx_commission_agents_office_id;

COMMENT ON FUNCTION recalculate_commission_batch_fiscal IS 'Recalcula valores fiscales de un lote - usa usuarios en lugar de commission_agents';
COMMENT ON FUNCTION get_available_commission_batches_for_user IS 'Obtiene lotes de comisiones disponibles para un usuario - usa usuarios en lugar de commission_agents';
COMMENT ON FUNCTION apply_vendor_mappings_to_commission_details IS 'Aplica mapeos de vendedores a detalles de comisiones - usa usuarios en lugar de commission_agents';
COMMENT ON FUNCTION assign_vendor_manually_to_commission_detail IS 'Asigna vendedor manualmente a detalle de comisión - usa usuarios en lugar de commission_agents';
