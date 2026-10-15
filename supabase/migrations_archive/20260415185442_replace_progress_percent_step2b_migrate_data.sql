/*
  # Replace progress_percent - Step 2b: Migrate Existing Data (fixed column names)
*/

DO $$
DECLARE
  v_iniciado_id uuid;
  v_cotizado_id uuid;
  v_emitido_ganado_id uuid;
  v_no_emitido_perdido_id uuid;
BEGIN
  SELECT id INTO v_iniciado_id FROM ticket_estatus WHERE nombre = 'Iniciado' LIMIT 1;
  SELECT id INTO v_cotizado_id FROM ticket_estatus WHERE nombre = 'Cotizado' LIMIT 1;
  SELECT id INTO v_emitido_ganado_id FROM ticket_estatus WHERE nombre = 'Emitido (Ganado)' LIMIT 1;
  SELECT id INTO v_no_emitido_perdido_id FROM ticket_estatus WHERE nombre = 'No Emitido (Perdido)' LIMIT 1;

  -- progress_percent = 50/25/75 → Cotizado
  UPDATE tickets
  SET estatus_id = v_cotizado_id
  WHERE tipo_tramite = 'registro_actividad'
    AND (progress_percent = 50 OR progress_percent = 25 OR progress_percent = 75);

  -- progress_percent = 100 → Emitido (Ganado) + mark closed
  UPDATE tickets
  SET estatus_id = v_emitido_ganado_id,
      cerrado = true,
      fecha_cierre = COALESCE(completion_datetime, cerrado_en, ultima_modificacion, now()),
      resultado = 'ganado'
  WHERE tipo_tramite = 'registro_actividad'
    AND progress_percent = 100;

  -- Old "Emitido" status → Emitido (Ganado)
  UPDATE tickets
  SET estatus_id = v_emitido_ganado_id,
      cerrado = true,
      fecha_cierre = COALESCE(completion_datetime, cerrado_en, ultima_modificacion, now()),
      resultado = 'ganado'
  WHERE tipo_tramite = 'registro_actividad'
    AND estatus_id IN (
      SELECT id FROM ticket_estatus WHERE nombre = 'Emitido'
    );

  -- Old "No Emitido" status → No Emitido (Perdido)
  UPDATE tickets
  SET estatus_id = v_no_emitido_perdido_id,
      cerrado = true,
      fecha_cierre = COALESCE(completion_datetime, cerrado_en, ultima_modificacion, now()),
      resultado = 'perdido'
  WHERE tipo_tramite = 'registro_actividad'
    AND estatus_id IN (
      SELECT id FROM ticket_estatus WHERE nombre = 'No Emitido'
    );

  -- Old "En Proceso" status → Cotizado
  UPDATE tickets
  SET estatus_id = v_cotizado_id
  WHERE tipo_tramite = 'registro_actividad'
    AND estatus_id IN (
      SELECT id FROM ticket_estatus WHERE nombre = 'En Proceso'
    );

END $$;
