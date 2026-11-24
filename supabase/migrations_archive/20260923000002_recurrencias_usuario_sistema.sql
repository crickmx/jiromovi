/*
  # ejecutar_recurrencias(): usar el usuario Sistema como creador

  Único cambio respecto a la versión en producción (verificada con
  `select prosrc from pg_proc where proname = 'ejecutar_recurrencias'` el
  2026-09-23): la resolución de `v_system_user_id`. Antes agarraba al
  Administrador/Gerente más antiguo de la base, lo que le colgaba trámites
  que nunca creó a una persona real. Ahora usa el usuario dedicado que crea
  `20260923000001_usuario_sistema.sql`.

  El fallback al admin más antiguo se conserva a propósito: si esta migración
  se corre antes que la del usuario Sistema (o en un ambiente donde no exista),
  la generación de recurrencias sigue funcionando en vez de tronar por el
  NOT NULL de tickets.creado_por. Todo lo demás del cuerpo es idéntico.
*/

CREATE OR REPLACE FUNCTION public.ejecutar_recurrencias()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  hoy                   date;
  dow                   int;
  dom                   int;
  v_hora                int;
  v_fallback_estatus_id uuid;
  v_system_user_id      uuid;
  rec                   RECORD;
  miembro               RECORD;
  v_estatus_id          uuid;
  v_creado_por          uuid;
  v_tickets_creados     int;
  v_total               int := 0;
BEGIN
  hoy    := (NOW() AT TIME ZONE 'America/Mexico_City')::date;
  dow    := EXTRACT(DOW  FROM NOW() AT TIME ZONE 'America/Mexico_City')::int;
  dom    := EXTRACT(DAY  FROM NOW() AT TIME ZONE 'America/Mexico_City')::int;
  v_hora := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Mexico_City')::int;

  SELECT id INTO v_fallback_estatus_id
    FROM ticket_estatus WHERE activo = true ORDER BY orden ASC LIMIT 1;

  -- ▼ ÚNICO CAMBIO: usuario dedicado en vez del admin más antiguo.
  SELECT id INTO v_system_user_id FROM usuarios WHERE username = 'sistema';
  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
      FROM usuarios WHERE rol IN ('Administrador', 'Gerente') ORDER BY created_at ASC LIMIT 1;
  END IF;
  -- ▲ FIN DEL CAMBIO

  FOR rec IN
    SELECT r.*, t.value AS tipo_tramite_value
    FROM ticket_tipos_recurrencia r
    JOIN ticket_tipos t ON t.id = r.ticket_tipo_id
    WHERE r.activo = true
      AND r.fecha_inicio <= hoy
      AND (r.fecha_fin IS NULL OR r.fecha_fin >= hoy)
      AND EXTRACT(HOUR FROM r.hora_disparo) = v_hora
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

    -- Reservar slot en log (guard contra doble ejecución por race condition)
    INSERT INTO ticket_recurrencia_log (recurrencia_id, fecha_generada, tickets_creados)
    VALUES (rec.id, hoy, 0)
    ON CONFLICT (recurrencia_id, fecha_generada) DO NOTHING;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_estatus_id      := COALESCE(rec.estatus_id_inicial, v_fallback_estatus_id);
    v_creado_por      := COALESCE(rec.created_by, v_system_user_id);
    v_tickets_creados := 0;

    IF rec.asignacion_tipo = 'usuario_especifico' AND rec.usuario_id IS NOT NULL THEN

      INSERT INTO tickets (
        tipo_tramite, estatus_id, prioridad, instrucciones,
        creado_por, modificado_por, assigned_to_user_id, grupo_asignado_id,
        recurrencia_id, fecha_vencimiento_tarea
      ) VALUES (
        rec.tipo_tramite_value, v_estatus_id, 'Media', rec.nombre,
        v_creado_por, v_creado_por, rec.usuario_id, rec.grupo_id,
        rec.id, hoy + rec.dias_para_vencer
      );
      v_tickets_creados := 1;

    ELSIF rec.asignacion_tipo = 'usuarios_especificos' THEN

      FOR miembro IN
        SELECT usuario_id FROM ticket_tipos_recurrencia_usuarios WHERE recurrencia_id = rec.id
      LOOP
        INSERT INTO tickets (
          tipo_tramite, estatus_id, prioridad, instrucciones,
          creado_por, modificado_por, assigned_to_user_id, grupo_asignado_id,
          recurrencia_id, fecha_vencimiento_tarea
        ) VALUES (
          rec.tipo_tramite_value, v_estatus_id, 'Media', rec.nombre,
          v_creado_por, v_creado_por, miembro.usuario_id, rec.grupo_id,
          rec.id, hoy + rec.dias_para_vencer
        );
        v_tickets_creados := v_tickets_creados + 1;
      END LOOP;

    ELSIF rec.asignacion_tipo = 'pool' THEN

      INSERT INTO tickets (
        tipo_tramite, estatus_id, prioridad, instrucciones,
        creado_por, modificado_por, assigned_to_user_id, grupo_asignado_id,
        recurrencia_id, fecha_vencimiento_tarea
      ) VALUES (
        rec.tipo_tramite_value, v_estatus_id, 'Media', rec.nombre,
        v_creado_por, v_creado_por, NULL, rec.grupo_id,
        rec.id, hoy + rec.dias_para_vencer
      );
      v_tickets_creados := 1;

    ELSIF rec.asignacion_tipo = 'todos_del_grupo' AND rec.grupo_id IS NOT NULL THEN

      FOR miembro IN
        SELECT usuario_id FROM tramites_grupos_miembros WHERE grupo_id = rec.grupo_id
      LOOP
        INSERT INTO tickets (
          tipo_tramite, estatus_id, prioridad, instrucciones,
          creado_por, modificado_por, assigned_to_user_id, grupo_asignado_id,
          recurrencia_id, fecha_vencimiento_tarea
        ) VALUES (
          rec.tipo_tramite_value, v_estatus_id, 'Media', rec.nombre,
          v_creado_por, v_creado_por, miembro.usuario_id, rec.grupo_id,
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

  RETURN jsonb_build_object('fecha', hoy, 'hora', v_hora, 'tickets_creados', v_total);
END;
$$;
