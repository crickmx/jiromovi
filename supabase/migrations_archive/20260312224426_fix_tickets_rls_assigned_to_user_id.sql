/*
  # Fix Tickets RLS - Usar assigned_to_user_id

  1. Correcciones
    - Actualizar políticas RLS para usar assigned_to_user_id en lugar de agente_id
    - Considerar también ticket_asignaciones para verificar si el usuario está asignado
    - Mantener filtros apropiados por rol (Admin/Gerente ven todos, Agentes solo los suyos)

  2. Security
    - Administrador y Gerente pueden ver todos los trámites
    - Agentes y otros roles solo ven:
      * Trámites donde están asignados directamente (assigned_to_user_id)
      * Trámites donde están en ticket_asignaciones
      * Trámites que crearon
*/

-- =====================================================
-- ACTUALIZAR POLÍTICAS DE TICKETS
-- =====================================================

-- Eliminar política actual que permite ver todo
DROP POLICY IF EXISTS "tickets_select_all_authenticated" ON tickets;
DROP POLICY IF EXISTS "tickets_select_all_conditions" ON tickets;
DROP POLICY IF EXISTS "tickets_select_by_role_and_assignment" ON tickets;
DROP POLICY IF EXISTS "Agents can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Staff can view all tickets" ON tickets;

-- Crear nueva política con lógica correcta
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
    -- Usuario está asignado directamente
    assigned_to_user_id = auth.uid()
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

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON POLICY "tickets_select_by_role_and_user" ON tickets IS
'Admin y Gerente ven todos. Otros usuarios solo ven trámites donde están asignados (assigned_to_user_id o ticket_asignaciones) o que crearon';
