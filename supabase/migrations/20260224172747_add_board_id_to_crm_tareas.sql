/*
  # Vincular Tareas del CRM con Tableros Compartidos

  1. Cambios en Schema
    - Agregar `board_id` a crm_tareas (nullable, FK a crm_boards)
    - Las tareas sin board_id son tareas personales (compatibilidad retroactiva)
    - Las tareas con board_id pertenecen a un tablero compartido

  2. Políticas RLS Actualizadas
    - Permitir ver tareas de tableros donde soy miembro
    - Permitir crear tareas en tableros donde tengo permiso de editor/admin/owner
    - Permitir actualizar tareas de tableros donde tengo permiso de editor/admin/owner
    - Permitir eliminar tareas de tableros donde tengo permiso de admin/owner
    - Mantener acceso a tareas personales (sin board_id)

  3. Índices
    - Índice para board_id
    - Índice compuesto para board_id + estatus

  4. Notas Importantes
    - Backward compatible: tareas sin board_id siguen funcionando
    - Las tareas personales (board_id IS NULL) solo las ve su creador
    - Las tareas de tablero las ven todos los miembros según su rol
*/

-- ============================================
-- PASO 1: AGREGAR COLUMNA board_id
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crm_tareas' AND column_name = 'board_id'
  ) THEN
    ALTER TABLE crm_tareas
    ADD COLUMN board_id uuid REFERENCES crm_boards(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- PASO 2: CREAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_crm_tareas_board_id
ON crm_tareas(board_id);

CREATE INDEX IF NOT EXISTS idx_crm_tareas_board_estatus
ON crm_tareas(board_id, estatus);

-- ============================================
-- PASO 3: FUNCIÓN HELPER PARA VERIFICAR PERMISOS
-- ============================================

CREATE OR REPLACE FUNCTION user_can_view_board(p_board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM crm_board_members
    WHERE board_id = p_board_id
    AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION user_can_edit_board(p_board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM crm_board_members
    WHERE board_id = p_board_id
    AND user_id = auth.uid()
    AND member_role IN ('owner', 'admin', 'editor')
  );
END;
$$;

CREATE OR REPLACE FUNCTION user_can_admin_board(p_board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM crm_board_members
    WHERE board_id = p_board_id
    AND user_id = auth.uid()
    AND member_role IN ('owner', 'admin')
  );
END;
$$;

-- ============================================
-- PASO 4: ACTUALIZAR POLÍTICAS RLS
-- ============================================

DROP POLICY IF EXISTS "Usuarios pueden ver solo sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios pueden crear sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus tareas" ON crm_tareas;

-- SELECT: Ver tareas personales O tareas de tableros donde soy miembro
CREATE POLICY "Users can view personal tasks or board tasks"
  ON crm_tareas
  FOR SELECT
  TO authenticated
  USING (
    -- Tareas personales (sin tablero)
    (board_id IS NULL AND creado_por = auth.uid())
    OR
    -- Tareas de tableros donde soy miembro
    (board_id IS NOT NULL AND user_can_view_board(board_id))
  );

-- INSERT: Crear tareas personales O tareas en tableros donde puedo editar
CREATE POLICY "Users can create personal tasks or board tasks with editor role"
  ON crm_tareas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creado_por = auth.uid()
    AND (
      -- Tarea personal
      board_id IS NULL
      OR
      -- Tarea de tablero donde puedo editar
      (board_id IS NOT NULL AND user_can_edit_board(board_id))
    )
  );

-- UPDATE: Actualizar tareas propias personales O tareas de tableros donde puedo editar
CREATE POLICY "Users can update personal tasks or board tasks with editor role"
  ON crm_tareas
  FOR UPDATE
  TO authenticated
  USING (
    -- Tarea personal propia
    (board_id IS NULL AND creado_por = auth.uid())
    OR
    -- Tarea de tablero donde puedo editar
    (board_id IS NOT NULL AND user_can_edit_board(board_id))
  )
  WITH CHECK (
    -- No se puede cambiar el creador
    creado_por = (SELECT creado_por FROM crm_tareas WHERE id = crm_tareas.id)
  );

-- DELETE: Eliminar tareas propias personales O tareas de tableros donde soy admin
CREATE POLICY "Users can delete personal tasks or board tasks with admin role"
  ON crm_tareas
  FOR DELETE
  TO authenticated
  USING (
    -- Tarea personal propia
    (board_id IS NULL AND creado_por = auth.uid())
    OR
    -- Tarea de tablero donde soy admin/owner
    (board_id IS NOT NULL AND user_can_admin_board(board_id))
  );
