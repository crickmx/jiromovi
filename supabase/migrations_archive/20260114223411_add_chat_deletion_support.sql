/*
  # Agregar soporte para eliminación de conversaciones por usuario

  1. Cambios en Tablas
    - `chat_miembros`
      - `oculto` (boolean): Si el usuario ha ocultado esta conversación de su lista
      - `oculto_at` (timestamptz): Cuándo el usuario ocultó la conversación
      - `eliminado` (boolean): Si el usuario ha eliminado esta conversación (no puede volver a aparecer)
      - `eliminado_at` (timestamptz): Cuándo el usuario eliminó la conversación

  2. Funcionalidad
    - Los usuarios pueden ocultar conversaciones (se pueden mostrar de nuevo)
    - Los usuarios pueden eliminar conversaciones permanentemente de su vista
    - La eliminación es por usuario, no afecta a otros miembros
    - Los mensajes y el chat en sí permanecen intactos para otros usuarios

  3. Seguridad
    - Solo el propio usuario puede modificar su estado de eliminación/ocultamiento
    - Las políticas RLS se actualizan para excluir chats eliminados/ocultos
*/

-- Agregar campos de eliminación/ocultamiento a chat_miembros
ALTER TABLE chat_miembros
ADD COLUMN IF NOT EXISTS oculto boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS oculto_at timestamptz,
ADD COLUMN IF NOT EXISTS eliminado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS eliminado_at timestamptz;

-- Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_chat_miembros_oculto
  ON chat_miembros(usuario_id, oculto)
  WHERE oculto = false;

CREATE INDEX IF NOT EXISTS idx_chat_miembros_eliminado
  ON chat_miembros(usuario_id, eliminado)
  WHERE eliminado = false;

-- Función para ocultar un chat para un usuario
CREATE OR REPLACE FUNCTION ocultar_chat(p_chat_id uuid, p_usuario_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario sea miembro del chat
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembros
    WHERE chat_id = p_chat_id
    AND usuario_id = p_usuario_id
  ) THEN
    RAISE EXCEPTION 'Usuario no es miembro de este chat';
  END IF;

  -- Ocultar el chat
  UPDATE chat_miembros
  SET oculto = true,
      oculto_at = now()
  WHERE chat_id = p_chat_id
  AND usuario_id = p_usuario_id;

  RETURN true;
END;
$$;

-- Función para eliminar un chat para un usuario
CREATE OR REPLACE FUNCTION eliminar_chat(p_chat_id uuid, p_usuario_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario sea miembro del chat
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembros
    WHERE chat_id = p_chat_id
    AND usuario_id = p_usuario_id
  ) THEN
    RAISE EXCEPTION 'Usuario no es miembro de este chat';
  END IF;

  -- Eliminar el chat (soft delete)
  UPDATE chat_miembros
  SET eliminado = true,
      eliminado_at = now(),
      oculto = true,
      oculto_at = now()
  WHERE chat_id = p_chat_id
  AND usuario_id = p_usuario_id;

  RETURN true;
END;
$$;

-- Función para restaurar un chat oculto
CREATE OR REPLACE FUNCTION restaurar_chat(p_chat_id uuid, p_usuario_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario sea miembro del chat
  IF NOT EXISTS (
    SELECT 1 FROM chat_miembros
    WHERE chat_id = p_chat_id
    AND usuario_id = p_usuario_id
  ) THEN
    RAISE EXCEPTION 'Usuario no es miembro de este chat';
  END IF;

  -- Restaurar el chat (solo si no está eliminado permanentemente)
  UPDATE chat_miembros
  SET oculto = false,
      oculto_at = NULL
  WHERE chat_id = p_chat_id
  AND usuario_id = p_usuario_id
  AND eliminado = false;

  RETURN true;
END;
$$;

-- Recrear la función de acceso al chat
CREATE OR REPLACE FUNCTION user_has_chat_access()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND rol IN ('Administrador', 'Gerente', 'Empleado')
    AND activo = true
  );
$$;

-- Actualizar política RLS para excluir chats eliminados/ocultos
DROP POLICY IF EXISTS "Usuarios autorizados pueden ver sus chats" ON chats;

CREATE POLICY "Usuarios autorizados pueden ver sus chats"
  ON chats FOR SELECT
  TO authenticated
  USING (
    user_has_chat_access()
    AND EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chats.id
      AND chat_miembros.usuario_id = auth.uid()
      AND chat_miembros.eliminado = false
      AND chat_miembros.oculto = false
    )
  );

-- Agregar política para que usuarios puedan actualizar su estado de membresía
DROP POLICY IF EXISTS "Usuarios pueden actualizar su estado de membresía" ON chat_miembros;

CREATE POLICY "Usuarios pueden actualizar su estado de membresía"
  ON chat_miembros FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Comentarios en funciones
COMMENT ON FUNCTION ocultar_chat(uuid, uuid) IS
  'Oculta un chat de la vista del usuario. El chat puede ser restaurado.';

COMMENT ON FUNCTION eliminar_chat(uuid, uuid) IS
  'Elimina permanentemente un chat de la vista del usuario. No puede ser restaurado.';

COMMENT ON FUNCTION restaurar_chat(uuid, uuid) IS
  'Restaura un chat previamente oculto (solo si no fue eliminado permanentemente).';
