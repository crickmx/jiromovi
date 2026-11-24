/*
  # Fix: Separar Lotes por Usuario y Recalcular Valores Fiscales

  1. Problem
    - Los lotes semanales mezclan múltiples usuarios con diferentes regímenes fiscales
    - Los valores fiscales no se calculan (calculated_at es NULL)
    - Los PDFs fallan porque no hay valores calculados
    
  2. Changes
    - Crear función para reorganizar commission_details en lotes separados por usuario
    - Crear función para recalcular valores fiscales de lotes existentes
    - Aplicar la reorganización a los lotes problemáticos
    
  3. Security
    - Funciones SECURITY DEFINER para poder modificar batches y details
*/

-- ============================================
-- FUNCIÓN PARA RECALCULAR VALORES FISCALES DE UN LOTE
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_batch_fiscal_values(
  p_batch_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_usuario_id UUID;
  v_regimen_fiscal TEXT;
  v_commission_vida NUMERIC;
  v_commission_sinvida NUMERIC;
  v_commission_total NUMERIC;
  v_retencion_contable NUMERIC;
  v_costo_dispersion NUMERIC;
  v_iva NUMERIC;
  v_ret_isr NUMERIC;
  v_ret_iva NUMERIC;
  v_total_neto NUMERIC;
  v_desglose JSONB;
BEGIN
  -- Obtener el usuario del lote (debe ser único)
  SELECT DISTINCT usuario_id INTO v_usuario_id
  FROM commission_details
  WHERE batch_id = p_batch_id
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró usuario para el lote %', p_batch_id;
  END IF;

  -- Verificar que todos los details tengan el mismo usuario
  IF EXISTS (
    SELECT 1 FROM commission_details
    WHERE batch_id = p_batch_id
      AND usuario_id != v_usuario_id
  ) THEN
    RAISE EXCEPTION 'El lote % tiene múltiples usuarios. Debe separarse primero.', p_batch_id;
  END IF;

  -- Obtener régimen fiscal del usuario
  SELECT 
    CASE 
      WHEN cfr.id IS NOT NULL THEN cfr.nombre
      ELSE 'HONORARIOS'
    END INTO v_regimen_fiscal
  FROM usuarios u
  LEFT JOIN commission_fiscal_regimes cfr ON cfr.id = u.regimen_fiscal_id
  WHERE u.id = v_usuario_id;

  -- Calcular totales base
  SELECT 
    COALESCE(SUM(CASE WHEN tipo_seguro = 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_seguro != 'VIDA' THEN commission_neta ELSE 0 END), 0),
    COALESCE(SUM(commission_neta), 0)
  INTO v_commission_vida, v_commission_sinvida, v_commission_total
  FROM commission_details
  WHERE batch_id = p_batch_id;

  -- Calcular desglose fiscal según régimen
  IF v_regimen_fiscal = 'ASIMILADOS' THEN
    SELECT * INTO v_desglose FROM calcular_desglose_asimilados(
      v_commission_vida,
      v_commission_sinvida
    );
  ELSIF v_regimen_fiscal = 'RESICO' THEN
    SELECT * INTO v_desglose FROM calcular_desglose_resico(
      v_commission_vida,
      v_commission_sinvida
    );
  ELSE -- HONORARIOS
    SELECT * INTO v_desglose FROM calcular_desglose_honorarios(
      v_commission_vida,
      v_commission_sinvida
    );
  END IF;

  -- Extraer valores del desglose
  v_retencion_contable := COALESCE((v_desglose->>'retContable')::NUMERIC, 0);
  v_costo_dispersion := COALESCE((v_desglose->>'costoDispersion')::NUMERIC, 0);
  v_iva := COALESCE((v_desglose->>'iva')::NUMERIC, 0);
  v_ret_isr := COALESCE((v_desglose->>'retIsr')::NUMERIC, 0);
  v_ret_iva := COALESCE((v_desglose->>'retIva')::NUMERIC, 0);
  v_total_neto := COALESCE((v_desglose->>'totalAPagar')::NUMERIC, 0);

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
    fiscal_desglose_json = v_desglose,
    calculated_at = NOW(),
    tax_version = '2026-v1',
    updated_at = NOW()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'usuario_id', v_usuario_id,
    'regimen_fiscal', v_regimen_fiscal,
    'total_neto', v_total_neto
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN PARA REORGANIZAR LOTES POR USUARIO
-- ============================================

CREATE OR REPLACE FUNCTION reorganize_batch_by_user(
  p_batch_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_batch_info RECORD;
  v_usuario_record RECORD;
  v_new_batch_id UUID;
  v_new_batch_name TEXT;
  v_moved_count INTEGER := 0;
  v_created_batches JSONB := '[]'::JSONB;
BEGIN
  -- Obtener info del batch original
  SELECT * INTO v_batch_info
  FROM commission_batches
  WHERE id = p_batch_id;

  IF v_batch_info IS NULL THEN
    RAISE EXCEPTION 'Lote % no encontrado', p_batch_id;
  END IF;

  -- Para cada usuario en el batch
  FOR v_usuario_record IN
    SELECT 
      usuario_id,
      u.nombre_completo,
      COUNT(*) as detail_count
    FROM commission_details cd
    JOIN usuarios u ON u.id = cd.usuario_id
    WHERE cd.batch_id = p_batch_id
    GROUP BY usuario_id, u.nombre_completo
    HAVING COUNT(*) > 0
    ORDER BY usuario_id
  LOOP
    -- Si es el primer usuario, usar el batch original
    IF v_moved_count = 0 THEN
      v_new_batch_id := p_batch_id;
      v_new_batch_name := v_batch_info.name;
      
      -- Eliminar otros usuarios del batch original
      DELETE FROM commission_details
      WHERE batch_id = p_batch_id
        AND usuario_id != v_usuario_record.usuario_id;
    ELSE
      -- Crear nuevo batch para los demás usuarios
      v_new_batch_name := v_batch_info.name || ' - ' || v_usuario_record.nombre_completo;
      
      INSERT INTO commission_batches (
        name,
        display_name,
        date_from,
        date_to,
        period_start,
        period_end,
        week_number,
        uploaded_by,
        status,
        source_type,
        created_at
      ) VALUES (
        v_new_batch_name,
        v_new_batch_name,
        v_batch_info.date_from,
        v_batch_info.date_to,
        v_batch_info.period_start,
        v_batch_info.period_end,
        v_batch_info.week_number,
        v_batch_info.uploaded_by,
        'draft',
        'reorganized',
        NOW()
      )
      RETURNING id INTO v_new_batch_id;

      -- Mover los details al nuevo batch
      UPDATE commission_details
      SET batch_id = v_new_batch_id
      WHERE batch_id = p_batch_id
        AND usuario_id = v_usuario_record.usuario_id;
    END IF;

    -- Recalcular valores fiscales del batch
    PERFORM recalculate_batch_fiscal_values(v_new_batch_id);

    v_created_batches := v_created_batches || jsonb_build_object(
      'batch_id', v_new_batch_id,
      'batch_name', v_new_batch_name,
      'usuario_id', v_usuario_record.usuario_id,
      'usuario_nombre', v_usuario_record.nombre_completo,
      'detail_count', v_usuario_record.detail_count
    );

    v_moved_count := v_moved_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'original_batch_id', p_batch_id,
    'batches_created', v_moved_count,
    'batches', v_created_batches
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_batch_fiscal_values IS 
'Recalcula los valores fiscales de un lote de comisiones según el régimen fiscal del usuario asignado.';

COMMENT ON FUNCTION reorganize_batch_by_user IS 
'Reorganiza un lote que tiene múltiples usuarios en lotes separados, uno por usuario, y recalcula los valores fiscales de cada uno.';
