/*
  # Corregir recursión infinita en políticas RLS de tickets y ticket_asignaciones

  1. Cambios
    - Eliminar todas las políticas que causan recursión
    - Crear políticas simples sin subqueries recursivas
    - Usar políticas directas sin referencias cruzadas
    - Administradores y Gerentes ven TODO
    - Otros usuarios ven solo sus registros

  2. Seguridad
    - RLS habilitado en ambas tablas
    - Políticas restrictivas por defecto
    - Solo usuarios autenticados pueden acceder
*/

-- ============================================================================
-- TICKETS - Eliminar políticas existentes
-- ============================================================================
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_update_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_delete_policy" ON tickets;
DROP POLICY IF EXISTS "Agents can update own tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Staff can update all tickets" ON tickets;
DROP POLICY IF EXISTS "tickets_delete_admin_only" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_all_authenticated" ON tickets;
DROP POLICY IF EXISTS "tickets_select_by_role_and_user" ON tickets;
DROP POLICY IF EXISTS "tickets_update_by_role_or_direct" ON tickets;

-- ============================================================================
-- TICKET_ASIGNACIONES - Eliminar políticas existentes
-- ============================================================================
DROP POLICY IF EXISTS "ticket_asignaciones_select_policy" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_insert_policy" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_update_policy" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_delete_policy" ON ticket_asignaciones;

-- ============================================================================
-- TICKETS - Crear políticas SIN recursión
-- ============================================================================

-- SELECT: Admin/Gerente ven todo, usuarios normales ven sus trámites
CREATE POLICY "tickets_select_no_recursion"
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
  -- Usuarios ven trámites asignados directamente
  assigned_to_user_id = auth.uid()
  OR
  -- Usuarios ven trámites donde tienen agente_id
  agente_id = auth.uid()
);

-- INSERT: Todos los autenticados pueden crear trámites
CREATE POLICY "tickets_insert_authenticated"
ON tickets FOR INSERT
TO authenticated
WITH CHECK (
  creado_por = auth.uid()
);

-- UPDATE: Admin/Gerentes actualizan todo, demás solo sus trámites
CREATE POLICY "tickets_update_by_role_or_owner"
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
  OR
  agente_id = auth.uid()
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
  OR
  agente_id = auth.uid()
);

-- DELETE: Solo administradores
CREATE POLICY "tickets_delete_admin"
ON tickets FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
  )
);

-- ============================================================================
-- TICKET_ASIGNACIONES - Crear políticas SIN recursión
-- ============================================================================

-- SELECT: Admin/Gerente ven todo, usuarios ven sus asignaciones
CREATE POLICY "ticket_asignaciones_select_simple"
ON ticket_asignaciones FOR SELECT
TO authenticated
USING (
  -- Administradores y Gerentes ven todas las asignaciones
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
  )
  OR
  -- Usuarios ven asignaciones donde son el ejecutivo
  ejecutivo_id = auth.uid()
  OR
  -- Usuarios ven asignaciones que ellos crearon
  asignado_por = auth.uid()
);

-- INSERT: Admin/Gerente pueden crear asignaciones
CREATE POLICY "ticket_asignaciones_insert_staff"
ON ticket_asignaciones FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
  )
  AND asignado_por = auth.uid()
);

-- UPDATE: Solo Admin/Gerente
CREATE POLICY "ticket_asignaciones_update_staff"
ON ticket_asignaciones FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
  )
);

-- DELETE: Solo Admin/Gerente
CREATE POLICY "ticket_asignaciones_delete_staff"
ON ticket_asignaciones FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
  )
);

-- ============================================================================
-- Comentarios
-- ============================================================================

COMMENT ON POLICY "tickets_select_no_recursion" ON tickets IS
'Admin/Gerente ven todo. Otros ven trámites creados por ellos o asignados directamente (sin recursión)';

COMMENT ON POLICY "tickets_insert_authenticated" ON tickets IS
'Todos los autenticados pueden crear trámites';

COMMENT ON POLICY "tickets_update_by_role_or_owner" ON tickets IS
'Admin/Gerente actualizan todo. Otros solo sus trámites asignados';

COMMENT ON POLICY "tickets_delete_admin" ON tickets IS
'Solo administradores pueden eliminar trámites';

COMMENT ON POLICY "ticket_asignaciones_select_simple" ON ticket_asignaciones IS
'Admin/Gerente ven todo. Otros ven sus asignaciones (sin recursión)';

COMMENT ON POLICY "ticket_asignaciones_insert_staff" ON ticket_asignaciones IS
'Solo Admin/Gerente pueden crear asignaciones';

COMMENT ON POLICY "ticket_asignaciones_update_staff" ON ticket_asignaciones IS
'Solo Admin/Gerente pueden actualizar asignaciones';

COMMENT ON POLICY "ticket_asignaciones_delete_staff" ON ticket_asignaciones IS
'Solo Admin/Gerente pueden eliminar asignaciones';
