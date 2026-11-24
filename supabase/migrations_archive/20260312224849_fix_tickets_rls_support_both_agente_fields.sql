/*
  # Fix Tickets RLS - Soportar ambos campos agente_id y assigned_to_user_id

  1. Correcciones
    - Actualizar política SELECT para considerar AMBOS campos (agente_id y assigned_to_user_id)
    - Esto permite compatibilidad con trámites antiguos que usan agente_id
    - Mantiene soporte para trámites nuevos que usan assigned_to_user_id

  2. Security
    - Admin y Gerente ven todos los trámites
    - Otros usuarios ven trámites donde están asignados en cualquiera de los dos campos
*/

-- Eliminar política actual
DROP POLICY IF EXISTS "tickets_select_by_role_and_user" ON tickets;

-- Crear política mejorada que considera ambos campos
CREATE POLICY "tickets_select_by_role_and_user"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    -- Administradores y Gerentes ven TODOS los trámites
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
    OR
    -- Usuario está asignado en el campo nuevo
    assigned_to_user_id = auth.uid()
    OR
    -- Usuario está asignado en el campo antiguo (para compatibilidad)
    agente_id = auth.uid()
    OR
    -- Usuario creó el trámite
    creado_por = auth.uid()
    OR
    -- Usuario está en la tabla de asignaciones
    EXISTS (
      SELECT 1 FROM ticket_asignaciones
      WHERE ticket_asignaciones.ticket_id = tickets.id
      AND ticket_asignaciones.ejecutivo_id = auth.uid()
    )
  );

-- También actualizar la política de UPDATE para usar ambos campos
DROP POLICY IF EXISTS "tickets_update_by_role_or_direct" ON tickets;

CREATE POLICY "tickets_update_by_role_or_direct"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    assigned_to_user_id = auth.uid()
    OR
    agente_id = auth.uid()
    OR
    creado_por = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente')
    )
    OR
    assigned_to_user_id = auth.uid()
    OR
    agente_id = auth.uid()
    OR
    creado_por = auth.uid()
  );

COMMENT ON POLICY "tickets_select_by_role_and_user" ON tickets IS
'Admin y Gerente ven todos. Otros usuarios ven trámites donde están asignados (agente_id O assigned_to_user_id O ticket_asignaciones) o que crearon';

COMMENT ON POLICY "tickets_update_by_role_or_direct" ON tickets IS
'Admin y Gerente actualizan todos. Otros usuarios actualizan trámites donde están asignados o que crearon';
