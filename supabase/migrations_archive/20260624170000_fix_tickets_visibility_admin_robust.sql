/*
  # Fix tickets SELECT — admin check robusto

  El check get_my_rol() puede tener problemas de timing o caché.
  Esta migración reemplaza la condición de admin/gerente con un EXISTS directo
  a la tabla usuarios que es más confiable y maneja diferencias de capitalización.
*/

DROP POLICY IF EXISTS "tickets_select_v4" ON tickets;

CREATE POLICY "tickets_select_v4"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    -- 1. Administrador o Gerente (check directo, sin función intermedia)
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND LOWER(u.rol) IN ('administrador', 'gerente', 'admin')
    )

    OR

    -- 2. Participante directo del ticket
    agente_id             = auth.uid()
    OR creado_por         = auth.uid()
    OR assigned_to_user_id = auth.uid()
    OR agente_usuario_id  = auth.uid()
    OR attending_user_id  = auth.uid()

    OR EXISTS (
      SELECT 1 FROM ticket_asignaciones ta
      WHERE ta.ticket_id = tickets.id
        AND ta.ejecutivo_id = auth.uid()
    )

    OR

    -- 3. Líder del equipo al que pertenece el ticket
    (
      grupo_asignado_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM tramites_grupos_miembros tgm
        WHERE tgm.grupo_id   = tickets.grupo_asignado_id
          AND tgm.usuario_id = auth.uid()
          AND tgm.rol_en_equipo = 'lider'
      )
    )

    OR

    -- 4. Ticket sin asignar en el pool del equipo (para auto-asignación)
    (
      assigned_to_user_id IS NULL
      AND attending_user_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM ticket_asignaciones ta
        WHERE ta.ticket_id = tickets.id
      )
      AND grupo_asignado_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM tramites_grupos_miembros tgm
        WHERE tgm.grupo_id   = tickets.grupo_asignado_id
          AND tgm.usuario_id = auth.uid()
      )
    )
  );
