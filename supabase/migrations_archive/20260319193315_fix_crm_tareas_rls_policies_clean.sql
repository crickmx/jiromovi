/*
  # Limpiar y simplificar políticas RLS de CRM Tareas

  1. Cambios
    - Eliminar políticas duplicadas y conflictivas
    - Simplificar políticas de UPDATE para evitar recursión
    - Mantener compatibilidad con tableros compartidos

  2. Políticas
    - SELECT: Usuarios pueden ver sus tareas o tareas de tableros compartidos
    - INSERT: Usuarios pueden crear tareas propias o en tableros con permisos
    - UPDATE: Usuarios pueden actualizar sus tareas o tareas de tableros con permisos
    - DELETE: Usuarios pueden eliminar sus tareas o tareas de tableros con permisos admin
*/

-- Eliminar todas las políticas existentes de crm_tareas
DROP POLICY IF EXISTS "Usuarios pueden ver sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Users can view personal tasks or board tasks" ON crm_tareas;
DROP POLICY IF EXISTS "Users can create personal tasks or board tasks with editor role" ON crm_tareas;
DROP POLICY IF EXISTS "Users can update personal tasks or board tasks with editor role" ON crm_tareas;
DROP POLICY IF EXISTS "Users can delete personal tasks or board tasks with admin role" ON crm_tareas;
DROP POLICY IF EXISTS "Service role can select tasks" ON crm_tareas;
DROP POLICY IF EXISTS "Service role can insert tasks" ON crm_tareas;

-- Política SELECT simplificada
CREATE POLICY "Users can view tasks"
  ON crm_tareas FOR SELECT
  TO authenticated
  USING (
    -- Tareas propias sin tablero
    (board_id IS NULL AND creado_por = auth.uid())
    OR
    -- Tareas de tableros donde el usuario tiene acceso
    (board_id IS NOT NULL AND user_can_view_board(board_id))
  );

-- Política INSERT simplificada
CREATE POLICY "Users can create tasks"
  ON crm_tareas FOR INSERT
  TO authenticated
  WITH CHECK (
    creado_por = auth.uid()
    AND (
      -- Tarea personal sin tablero
      board_id IS NULL
      OR
      -- Tarea en tablero donde tiene permisos de edición
      (board_id IS NOT NULL AND user_can_edit_board(board_id))
    )
  );

-- Política UPDATE simplificada (sin with_check recursivo)
CREATE POLICY "Users can update tasks"
  ON crm_tareas FOR UPDATE
  TO authenticated
  USING (
    -- Tareas propias sin tablero
    (board_id IS NULL AND creado_por = auth.uid())
    OR
    -- Tareas de tableros donde tiene permisos de edición
    (board_id IS NOT NULL AND user_can_edit_board(board_id))
  );

-- Política DELETE simplificada
CREATE POLICY "Users can delete tasks"
  ON crm_tareas FOR DELETE
  TO authenticated
  USING (
    -- Tareas propias sin tablero
    (board_id IS NULL AND creado_por = auth.uid())
    OR
    -- Tareas de tableros donde tiene permisos de admin
    (board_id IS NOT NULL AND user_can_admin_board(board_id))
  );

-- Permitir service_role acceso total (para edge functions)
CREATE POLICY "Service role full access"
  ON crm_tareas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
