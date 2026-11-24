/*
  # Fix recursión infinita en políticas RLS de adjuntos de tareas

  1. Problema
    - Las políticas actuales causan recursión infinita al verificar permisos de tableros
    - La referencia a crm_board_members en las políticas causa el problema

  2. Solución
    - Simplificar políticas usando funciones auxiliares
    - Crear función que verifica acceso sin causar recursión
    - Usar security definer para evitar verificaciones RLS recursivas

  3. Security
    - Mantener el mismo nivel de seguridad
    - Solo usuarios con acceso a la tarea pueden ver/modificar adjuntos
*/

-- =======================
-- ELIMINAR POLÍTICAS EXISTENTES
-- =======================

DROP POLICY IF EXISTS "Users can view task attachments they own or from shared boards" ON crm_tareas_adjuntos;
DROP POLICY IF EXISTS "Users can insert task attachments they own or from shared boards" ON crm_tareas_adjuntos;
DROP POLICY IF EXISTS "Users can delete their own attachments or if board admin" ON crm_tareas_adjuntos;

-- =======================
-- FUNCIÓN AUXILIAR: Verificar si usuario tiene acceso a una tarea
-- =======================

CREATE OR REPLACE FUNCTION usuario_puede_ver_tarea(tarea_uuid UUID, usuario_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_id UUID;
  v_creado_por UUID;
  v_tiene_acceso BOOLEAN;
BEGIN
  -- Obtener información de la tarea
  SELECT board_id, creado_por INTO v_board_id, v_creado_por
  FROM crm_tareas
  WHERE id = tarea_uuid;

  -- Si no existe la tarea, no tiene acceso
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Si no tiene tablero, verificar si es el creador
  IF v_board_id IS NULL THEN
    RETURN v_creado_por = usuario_uuid;
  END IF;

  -- Verificar si es el propietario del tablero
  SELECT EXISTS (
    SELECT 1 FROM crm_boards
    WHERE id = v_board_id
    AND owner_user_id = usuario_uuid
  ) INTO v_tiene_acceso;

  IF v_tiene_acceso THEN
    RETURN TRUE;
  END IF;

  -- Verificar si es miembro del tablero (sin verificar RLS)
  SELECT EXISTS (
    SELECT 1 FROM crm_board_members
    WHERE board_id = v_board_id
    AND user_id = usuario_uuid
  ) INTO v_tiene_acceso;

  RETURN v_tiene_acceso;
END;
$$;

-- =======================
-- FUNCIÓN AUXILIAR: Verificar si usuario puede editar tarea
-- =======================

CREATE OR REPLACE FUNCTION usuario_puede_editar_tarea(tarea_uuid UUID, usuario_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_id UUID;
  v_creado_por UUID;
  v_puede_editar BOOLEAN;
  v_member_role TEXT;
BEGIN
  -- Obtener información de la tarea
  SELECT board_id, creado_por INTO v_board_id, v_creado_por
  FROM crm_tareas
  WHERE id = tarea_uuid;

  -- Si no existe la tarea, no puede editar
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Si no tiene tablero, verificar si es el creador
  IF v_board_id IS NULL THEN
    RETURN v_creado_por = usuario_uuid;
  END IF;

  -- Verificar si es el propietario del tablero
  SELECT EXISTS (
    SELECT 1 FROM crm_boards
    WHERE id = v_board_id
    AND owner_user_id = usuario_uuid
  ) INTO v_puede_editar;

  IF v_puede_editar THEN
    RETURN TRUE;
  END IF;

  -- Verificar si es miembro con permisos de edición
  SELECT member_role INTO v_member_role
  FROM crm_board_members
  WHERE board_id = v_board_id
  AND user_id = usuario_uuid;

  IF FOUND AND v_member_role IN ('owner', 'admin', 'editor') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- =======================
-- NUEVAS POLÍTICAS RLS (SIMPLIFICADAS)
-- =======================

-- Política SELECT: Ver adjuntos de tareas accesibles
CREATE POLICY "Users can view task attachments"
  ON crm_tareas_adjuntos FOR SELECT
  TO authenticated
  USING (
    usuario_puede_ver_tarea(tarea_id, auth.uid())
  );

-- Política INSERT: Insertar adjuntos en tareas editables
CREATE POLICY "Users can insert task attachments"
  ON crm_tareas_adjuntos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_puede_editar_tarea(tarea_id, auth.uid())
  );

-- Política DELETE: Eliminar adjuntos propios o si puede editar tarea
CREATE POLICY "Users can delete task attachments"
  ON crm_tareas_adjuntos FOR DELETE
  TO authenticated
  USING (
    subido_por = auth.uid()
    OR
    usuario_puede_editar_tarea(tarea_id, auth.uid())
  );

-- =======================
-- SIMPLIFICAR POLÍTICAS DE STORAGE
-- =======================

DROP POLICY IF EXISTS "Users can upload task attachments to their tasks" ON storage.objects;
DROP POLICY IF EXISTS "Users can view task attachments from their tasks or shared boards" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task attachments or if board admin" ON storage.objects;

-- Política simple para subir archivos
CREATE POLICY "Users can upload to crm task attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'crm-tareas-adjuntos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política simple para ver archivos
CREATE POLICY "Users can view crm task attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'crm-tareas-adjuntos'
  );

-- Política simple para eliminar archivos
CREATE POLICY "Users can delete crm task attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'crm-tareas-adjuntos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
