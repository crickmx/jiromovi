/*
  # Fix: Orden Correcto en Reorganización de Lotes

  1. Changes
    - Mover details ANTES de recalcular
*/

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
  v_first_usuario_id UUID;
BEGIN
  -- Obtener info del batch original
  SELECT * INTO v_batch_info
  FROM commission_batches
  WHERE id = p_batch_id;

  IF v_batch_info IS NULL THEN
    RAISE EXCEPTION 'Lote % no encontrado', p_batch_id;
  END IF;

  -- Obtener el primer usuario (se quedará en el batch original)
  SELECT usuario_id INTO v_first_usuario_id
  FROM commission_details
  WHERE batch_id = p_batch_id
  GROUP BY usuario_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

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
    IF v_usuario_record.usuario_id = v_first_usuario_id THEN
      v_new_batch_id := p_batch_id;
      v_new_batch_name := v_batch_info.name || ' - ' || v_usuario_record.nombre_completo;
      
      -- Actualizar nombre del batch original
      UPDATE commission_batches
      SET 
        name = v_new_batch_name,
        display_name = v_new_batch_name
      WHERE id = p_batch_id;
      
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

      -- IMPORTANTE: Mover los details ANTES de recalcular
      UPDATE commission_details
      SET batch_id = v_new_batch_id
      WHERE batch_id = p_batch_id
        AND usuario_id = v_usuario_record.usuario_id;
    END IF;

    -- AHORA sí recalcular valores fiscales (después de que los details ya están en el batch)
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
