-- Engine de ejecución de trámites recurrentes
-- Complementa 20260727000001_tareas_recurrentes.sql (tablas ya existen).
-- Agrega la función que crea los tickets y el cron que la llama diariamente.

CREATE OR REPLACE FUNCTION public.ejecutar_recurrencias()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoy                   date;
  dow                   int;   -- 0=Dom, 1=Lun, ..., 6=Sáb  (EXTRACT DOW de PostgreSQL)
  dom                   int;   -- día del mes
  v_fallback_estatus_id uuid;
  rec                   RECORD;
  miembro               RECORD;
  v_estatus_id          uuid;
  v_tickets_creados     int;
  v_total               int := 0;
BEGIN
  hoy := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
  dow := EXTRACT(DOW FROM NOW() AT TIME ZONE 'America/Mexico_City')::int;
  dom := EXTRACT(DAY FROM NOW() AT TIME ZONE 'America/Mexico_City')::int;

  -- Estatus de fallback: el primero activo por orden cuando estatus_id_inicial es NULL
  SELECT id INTO v_fallback_estatus_id
  FROM ticket_estatus WHERE activo = true ORDER BY orden ASC LIMIT 1;

  FOR rec IN
    SELECT
      r.id,
      r.nombre,
      r.frecuencia,
      r.dias_semana,
      r.dia_mes,
      r.dias_para_vencer,
      r.asignacion_tipo,
      r.grupo_id,
      r.usuario_id,
      r.estatus_id_inicial,
      r.created_by,
      t.value AS tipo_tramite_value
    FROM ticket_tipos_recurrencia r
    JOIN ticket_tipos t ON t.id = r.ticket_tipo_id
    WHERE r.activo = true
      AND r.fecha_inicio <= hoy
      AND (r.fecha_fin IS NULL OR r.fecha_fin >= hoy)
      AND NOT EXISTS (
        SELECT 1 FROM ticket_recurrencia_log l
        WHERE l.recurrencia_id = r.id AND l.fecha_generada = hoy
      )
  LOOP
    -- Filtrar por frecuencia
    IF rec.frecuencia = 'semanal' AND NOT (dow = ANY(COALESCE(rec.dias_semana, '{}'::int[]))) THEN
      CONTINUE;
    END IF;
    IF rec.frecuencia = 'mensual' AND (rec.dia_mes IS NULL OR rec.dia_mes <> dom) THEN
      CONTINUE;
    END IF;

    -- Reservar slot en el log atómicamente (guarda contra doble ejecución)
    INSERT INTO ticket_recurrencia_log (recurrencia_id, fecha_generada, tickets_creados)
    VALUES (rec.id, hoy, 0)
    ON CONFLICT (recurrencia_id, fecha_generada) DO NOTHING;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_estatus_id      := COALESCE(rec.estatus_id_inicial, v_fallback_estatus_id);
    v_tickets_creados := 0;

    IF rec.asignacion_tipo = 'usuario_especifico' AND rec.usuario_id IS NOT NULL THEN

      INSERT INTO tickets (
        tipo_tramite, estatus_id, prioridad, instrucciones,
        creado_por, modificado_por,
        assigned_to_user_id, grupo_asignado_id,
        recurrencia_id, fecha_vencimiento_tarea
      ) VALUES (
        rec.tipo_tramite_value, v_estatus_id, 'Media', rec.nombre,
        rec.created_by, rec.created_by,
        rec.usuario_id, rec.grupo_id,
        rec.id, hoy + rec.dias_para_vencer
      );
      v_tickets_creados := 1;

    ELSIF rec.asignacion_tipo = 'pool' THEN

      INSERT INTO tickets (
        tipo_tramite, estatus_id, prioridad, instrucciones,
        assigned_to_user_id, grupo_asignado_id,
        recurrencia_id, fecha_vencimiento_tarea
      ) VALUES (
        rec.tipo_tramite_value, v_estatus_id, 'Media', rec.nombre,
        NULL, rec.grupo_id,
        rec.id, hoy + rec.dias_para_vencer
      );
      v_tickets_creados := 1;

    ELSIF rec.asignacion_tipo = 'todos_del_grupo' AND rec.grupo_id IS NOT NULL THEN

      FOR miembro IN
        SELECT usuario_id FROM tramites_grupos_miembros WHERE grupo_id = rec.grupo_id
      LOOP
        INSERT INTO tickets (
          tipo_tramite, estatus_id, prioridad, instrucciones,
          assigned_to_user_id, grupo_asignado_id,
          recurrencia_id, fecha_vencimiento_tarea
        ) VALUES (
          rec.tipo_tramite_value, v_estatus_id, 'Media', rec.nombre,
          miembro.usuario_id, rec.grupo_id,
          rec.id, hoy + rec.dias_para_vencer
        );
        v_tickets_creados := v_tickets_creados + 1;
      END LOOP;

    END IF;

    UPDATE ticket_recurrencia_log
    SET tickets_creados = v_tickets_creados
    WHERE recurrencia_id = rec.id AND fecha_generada = hoy;

    v_total := v_total + v_tickets_creados;
  END LOOP;

  RETURN jsonb_build_object('fecha', hoy, 'tickets_creados', v_total);
END;
$$;

-- Solo Administrador/Gerente pueden llamar la función directamente
REVOKE EXECUTE ON FUNCTION public.ejecutar_recurrencias() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ejecutar_recurrencias() TO service_role;

-- Cron: todos los días a las 8:00 am CST (14:00 UTC)
SELECT cron.unschedule('ejecutar-recurrencias-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ejecutar-recurrencias-diario');

SELECT cron.schedule(
  'ejecutar-recurrencias-diario',
  '0 14 * * *',
  $$ SELECT public.ejecutar_recurrencias() $$
);
