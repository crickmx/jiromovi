/*
  # Fix: Lógica Correcta para Reorganizar Lotes

  1. Changes
    - No borrar details, solo moverlos correctamente
    - El primer usuario se queda en el batch original
    - Los demás usuarios se mueven a batches nuevos
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
  v_is_first BOOLEAN := TRUE;
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
    ORDER BY COUNT(*) DESC, usuario_id -- El que tiene más items se queda en el original
  LOOP
    -- Si es el primer usuario, usar el batch original
    IF v_is_first THEN
      v_new_batch_id := p_batch_id;
      v_new_batch_name := v_batch_info.name || ' - ' || v_usuario_record.nombre_completo;
      v_first_usuario_id := v_usuario_record.usuario_id;
      
      -- Actualizar nombre del batch original
      UPDATE commission_batches
      SET 
        name = v_new_batch_name,
        display_name = v_new_batch_name,
        updated_at = NOW()
      WHERE id = p_batch_id;
      
      v_is_first := FALSE;
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

      -- Mover los details de este usuario al nuevo batch
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
