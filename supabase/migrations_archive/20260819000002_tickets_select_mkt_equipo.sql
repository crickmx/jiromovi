-- Actualiza la política SELECT de tickets para que el equipo MKT
-- pueda ver todos los tickets (necesario para el historial de agentes
-- en el panel de Marketing Premium).

DROP POLICY IF EXISTS "tickets_select_v7" ON tickets;
DROP POLICY IF EXISTS "tickets_select_v8" ON tickets;

CREATE POLICY "tickets_select_v8" ON tickets FOR SELECT TO authenticated USING (
  -- Admins y gerentes ven todo
  (get_my_rol() = ANY (ARRAY['Administrador'::text, 'Gerente'::text]))
  -- Equipo MKT ve todo (necesario para panel de Marketing Premium)
  OR EXISTS (
    SELECT 1
    FROM tramites_grupos_miembros tgm
    JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
    WHERE tgm.usuario_id = auth.uid()
  )
  -- Visibilidad individual estándar
  OR (agente_id          = auth.uid())
  OR (creado_por         = auth.uid())
  OR (assigned_to_user_id = auth.uid())
  OR (agente_usuario_id  = auth.uid())
  OR (attending_user_id  = auth.uid())
  -- Pool sin asignar del grupo del usuario
  OR (
    assigned_to_user_id IS NULL
    AND attending_user_id IS NULL
    AND grupo_asignado_id IS NOT NULL
    AND grupo_asignado_id = ANY (get_my_grupo_ids())
  )
  -- Todos los tickets del grupo donde el usuario es líder
  OR (
    grupo_asignado_id IS NOT NULL
    AND grupo_asignado_id = ANY (get_my_grupos_lider_ids())
  )
);
