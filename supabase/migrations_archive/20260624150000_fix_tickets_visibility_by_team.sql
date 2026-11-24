/*
  # Fix tickets SELECT visibility — equipo + rol

  ## Reglas nuevas
  - Administrador: ve todos los tickets
  - Líder de equipo (tramites_grupos_miembros.rol_en_equipo = 'lider'): ve todos los
    tickets de su equipo (grupo_asignado_id)
  - Ejecutivo / Miembro / Gerente / Empleado: solo ven:
      a) Sus propios tickets (agente, creador, responsable, ejecutivo asignado)
      b) Tickets sin asignar de su equipo (para auto-asignación desde el pool)

  ## Cambio respecto a política anterior
  Gerente y Empleado ya NO tienen acceso global — siguen reglas de equipo.
*/

-- Reemplazar política SELECT existente
DROP POLICY IF EXISTS "tickets_select_by_user_or_role" ON tickets;
DROP POLICY IF EXISTS "tickets_select_all_conditions" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;
DROP POLICY IF EXISTS "Agentes pueden ver sus tickets" ON tickets;

CREATE POLICY "tickets_select_v4"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    -- 1. Administrador y Gerente ven todo
    get_my_rol() IN ('Administrador', 'Gerente')

    OR

    -- 2. El usuario es participante directo del ticket
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

    -- 3. El usuario es líder del equipo al que pertenece el ticket
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

    -- 4. Ticket sin asignar en el pool del equipo del usuario (para auto-asignación)
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

-- Índice de soporte para la condición de liderazgo (evita seq scan en cada SELECT)
CREATE INDEX IF NOT EXISTS idx_tramites_grupos_miembros_grupo_lider
  ON tramites_grupos_miembros(grupo_id, usuario_id)
  WHERE rol_en_equipo = 'lider';

CREATE INDEX IF NOT EXISTS idx_tramites_grupos_miembros_grupo_usuario
  ON tramites_grupos_miembros(grupo_id, usuario_id);
