-- Mejoras al módulo de recurrencias:
-- 1. hora_disparo: hora del día (CST) en que se dispara la recurrencia
-- 2. usuarios_especificos: asignar a uno o más usuarios elegidos
-- 3. disparar_recurrencia_manual(): disparo manual desde el panel admin
-- 4. ejecutar_recurrencias() reescrito con todas las correcciones anteriores
-- 5. Cron cambia de diario a por-hora (para respetar hora_disparo)

-- ── 1. hora_disparo ───────────────────────────────────────────────────────────
ALTER TABLE ticket_tipos_recurrencia
  ADD COLUMN IF NOT EXISTS hora_disparo time NOT NULL DEFAULT '08:00';

-- ── 2. Ampliar CHECK de asignacion_tipo ───────────────────────────────────────
ALTER TABLE ticket_tipos_recurrencia
  DROP CONSTRAINT IF EXISTS ticket_tipos_recurrencia_asignacion_tipo_check;

ALTER TABLE ticket_tipos_recurrencia
  ADD CONSTRAINT ticket_tipos_recurrencia_asignacion_tipo_check
  CHECK (asignacion_tipo IN ('pool', 'todos_del_grupo', 'usuario_especifico', 'usuarios_especificos'));

-- ── 3. Tabla junction para asignación a usuarios específicos ──────────────────
CREATE TABLE IF NOT EXISTS ticket_tipos_recurrencia_usuarios (
  recurrencia_id uuid NOT NULL REFERENCES ticket_tipos_recurrencia(id) ON DELETE CASCADE,
  usuario_id     uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (recurrencia_id, usuario_id)
);

ALTER TABLE ticket_tipos_recurrencia_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_rw_recurrencia_usuarios" ON ticket_tipos_recurrencia_usuarios;
CREATE POLICY "admin_rw_recurrencia_usuarios" ON ticket_tipos_recurrencia_usuarios
  FOR ALL USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente'))
  );

DROP POLICY IF EXISTS "service_role_recurrencia_usuarios" ON ticket_tipos_recurrencia_usuarios;
CREATE POLICY "service_role_recurrencia_usuarios" ON ticket_tipos_recurrencia_usuarios
  FOR ALL USING (auth.role() = 'service_role');

-- ── 4. ejecutar_recurrencias() — versión completa y corregida ─────────────────
--   Fixes incluidos respecto a 20260729000001:
--   - v_system_user_id (COALESCE fallback para creado_por)
--   - creado_por/modificado_por en branch 'pool' (faltaban)
--   - NOT EXISTS en el WHERE del FOR (evita el IF NOT FOUND bug)
--   - Filtro por hora_disparo (cron ahora es por hora)
--   - Rama nueva 'usuarios_especificos'
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

  SELECT id INTO v_system_user_id
    FROM usuarios WHERE rol IN ('Administrador', 'Gerente') ORDER BY created_at ASC LIMIT 1;

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

REVOKE EXECUTE ON FUNCTION public.ejecutar_recurrencias() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ejecutar_recurrencias() TO service_role;

-- Cambiar cron de diario a por-hora (para que hora_disparo tenga efecto)
SELECT cron.unschedule('ejecutar-recurrencias-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ejecutar-recurrencias-diario');

SELECT cron.schedule(
  'ejecutar-recurrencias-diario',
  '0 * * * *',
  $$ SELECT public.ejecutar_recurrencias() $$
);

-- ── 5. disparar_recurrencia_manual() ─────────────────────────────────────────
-- Crea los tickets de una recurrencia específica de forma inmediata.
-- p_marcar_log=true → inserta en ticket_recurrencia_log (evita que el cron
--   duplique el disparo en la misma fecha).
CREATE OR REPLACE FUNCTION public.disparar_recurrencia_manual(
  p_recurrencia_id uuid,
  p_marcar_log     boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  hoy                   date;
  rec                   RECORD;
  miembro               RECORD;
  v_fallback_estatus_id uuid;
  v_system_user_id      uuid;
  v_estatus_id          uuid;
  v_creado_por          uuid;
  v_tickets_creados     int := 0;
  ya_ejecutado          boolean;
BEGIN
  hoy := (NOW() AT TIME ZONE 'America/Mexico_City')::date;

  SELECT r.*, t.value AS tipo_tramite_value
  INTO rec
  FROM ticket_tipos_recurrencia r
  JOIN ticket_tipos t ON t.id = r.ticket_tipo_id
  WHERE r.id = p_recurrencia_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Recurrencia no encontrada');
  END IF;

  ya_ejecutado := EXISTS (
    SELECT 1 FROM ticket_recurrencia_log
    WHERE recurrencia_id = p_recurrencia_id AND fecha_generada = hoy
  );

  SELECT id INTO v_fallback_estatus_id
    FROM ticket_estatus WHERE activo = true ORDER BY orden ASC LIMIT 1;

  SELECT id INTO v_system_user_id
    FROM usuarios WHERE rol IN ('Administrador', 'Gerente') ORDER BY created_at ASC LIMIT 1;

  v_estatus_id := COALESCE(rec.estatus_id_inicial, v_fallback_estatus_id);
  v_creado_por := COALESCE(rec.created_by, v_system_user_id);

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

  IF p_marcar_log THEN
    INSERT INTO ticket_recurrencia_log (recurrencia_id, fecha_generada, tickets_creados)
    VALUES (p_recurrencia_id, hoy, v_tickets_creados)
    ON CONFLICT (recurrencia_id, fecha_generada) DO UPDATE
      SET tickets_creados = ticket_recurrencia_log.tickets_creados + EXCLUDED.tickets_creados;
  END IF;

  RETURN jsonb_build_object(
    'tickets_creados', v_tickets_creados,
    'ya_ejecutado',    ya_ejecutado
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.disparar_recurrencia_manual(uuid, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.disparar_recurrencia_manual(uuid, boolean) TO authenticated;
