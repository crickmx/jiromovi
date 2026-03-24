/*
  # Refrescar cache de RLS para tickets

  1. Problema
    - El error indica que las políticas buscan 'requester_user_id' en el schema cache
    - Esta columna fue renombrada a 'agente_usuario_id'
    - Necesitamos recrear las políticas para refrescar el cache

  2. Solución
    - Eliminar políticas existentes
    - Recrearlas con las referencias correctas
    - Asegurar que empleados puedan crear tickets

  3. Políticas
    - SELECT: Ver tickets creados por el usuario o asignados a él
    - INSERT: Cualquier usuario autenticado puede crear (creado_por debe ser el usuario actual)
    - UPDATE: Solo admin, gerente, creador o asignado
    - DELETE: Solo admin
*/

-- Eliminar políticas existentes
DROP POLICY IF EXISTS tickets_select_no_recursion ON tickets;
DROP POLICY IF EXISTS tickets_insert_authenticated ON tickets;
DROP POLICY IF EXISTS tickets_update_by_role_or_owner ON tickets;
DROP POLICY IF EXISTS tickets_delete_admin ON tickets;

-- POLÍTICA SELECT: Ver tickets creados por el usuario, asignados a él, o si es admin/gerente
CREATE POLICY "tickets_select_by_user_or_role"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    -- Administradores y Gerentes ven todos los tickets
    (EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol IN ('Administrador', 'Gerente')
    ))
    OR
    -- Usuarios ven tickets donde son el creador, asignado, agente, o quien atiende
    (
      creado_por = auth.uid()
      OR assigned_to_user_id = auth.uid()
      OR agente_id = auth.uid()
      OR agente_usuario_id = auth.uid()
      OR attending_user_id = auth.uid()
    )
  );

-- POLÍTICA INSERT: Cualquier usuario autenticado puede crear tickets
CREATE POLICY "tickets_insert_by_authenticated"
  ON tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- El usuario que crea debe ser el mismo que auth.uid()
    creado_por = auth.uid()
  );

-- POLÍTICA UPDATE: Admin, Gerente, creador, o asignado pueden actualizar
CREATE POLICY "tickets_update_by_role_or_participant"
  ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    -- Administradores y Gerentes pueden actualizar todos
    (EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol IN ('Administrador', 'Gerente')
    ))
    OR
    -- Usuarios pueden actualizar tickets donde participan
    (
      creado_por = auth.uid()
      OR assigned_to_user_id = auth.uid()
      OR agente_id = auth.uid()
      OR agente_usuario_id = auth.uid()
      OR attending_user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Mismas condiciones para el with_check
    (EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol IN ('Administrador', 'Gerente')
    ))
    OR
    (
      creado_por = auth.uid()
      OR assigned_to_user_id = auth.uid()
      OR agente_id = auth.uid()
      OR agente_usuario_id = auth.uid()
      OR attending_user_id = auth.uid()
    )
  );

-- POLÍTICA DELETE: Solo administradores
CREATE POLICY "tickets_delete_by_admin"
  ON tickets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'Administrador'
    )
  );

-- Verificar que RLS está habilitado
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Agregar índices para optimizar las queries de RLS
CREATE INDEX IF NOT EXISTS idx_tickets_agente_usuario_id ON tickets(agente_usuario_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attending_user_id ON tickets(attending_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_creado_por ON tickets(creado_por);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_user_id ON tickets(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_agente_id ON tickets(agente_id);
