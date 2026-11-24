/*
  # Corregir políticas RLS de tickets - Simplificado

  1. Cambios
    - Eliminar todas las políticas duplicadas y conflictivas
    - Crear políticas claras y simples
    - Administradores y Gerentes ven TODO
    - Otros usuarios ven solo sus trámites (creados, asignados o en asignaciones)

  2. Seguridad
    - RLS habilitado
    - Políticas restrictivas por defecto
    - Solo usuarios autenticados pueden acceder
*/

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Agents can update own tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Staff can update all tickets" ON tickets;
DROP POLICY IF EXISTS "tickets_delete_admin_only" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_all_authenticated" ON tickets;
DROP POLICY IF EXISTS "tickets_select_by_role_and_user" ON tickets;
DROP POLICY IF EXISTS "tickets_update_by_role_or_direct" ON tickets;

-- Política SELECT: Administradores/Gerentes ven todo, demás solo sus trámites
CREATE POLICY "tickets_select_policy"
ON tickets FOR SELECT
TO authenticated
USING (
  -- Administradores y Gerentes ven todos los trámites
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
  )
  OR
  -- Usuarios ven trámites que crearon
  creado_por = auth.uid()
  OR
  -- Usuarios ven trámites asignados directamente (assigned_to_user_id)
  assigned_to_user_id = auth.uid()
  OR
  -- Usuarios ven trámites asignados en ticket_asignaciones
  EXISTS (
    SELECT 1 FROM ticket_asignaciones
    WHERE ticket_asignaciones.ticket_id = tickets.id
      AND ticket_asignaciones.ejecutivo_id = auth.uid()
  )
);

-- Política INSERT: Todos los autenticados pueden crear trámites
CREATE POLICY "tickets_insert_policy"
ON tickets FOR INSERT
TO authenticated
WITH CHECK (
  creado_por = auth.uid()
);

-- Política UPDATE: Admin/Gerentes actualizan todo, demás solo sus trámites
CREATE POLICY "tickets_update_policy"
ON tickets FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
  )
  OR
  creado_por = auth.uid()
  OR
  assigned_to_user_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
  )
  OR
  creado_por = auth.uid()
  OR
  assigned_to_user_id = auth.uid()
);

-- Política DELETE: Solo administradores
CREATE POLICY "tickets_delete_policy"
ON tickets FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
  )
);

COMMENT ON POLICY "tickets_select_policy" ON tickets IS 
'Admin/Gerente ven todo. Otros ven solo trámites creados por ellos o asignados a ellos';

COMMENT ON POLICY "tickets_insert_policy" ON tickets IS 
'Todos los autenticados pueden crear trámites';

COMMENT ON POLICY "tickets_update_policy" ON tickets IS 
'Admin/Gerente actualizan todo. Otros solo sus trámites';

COMMENT ON POLICY "tickets_delete_policy" ON tickets IS 
'Solo administradores pueden eliminar trámites';
