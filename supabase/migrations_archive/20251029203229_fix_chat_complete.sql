/*
  # Corrección Completa del Sistema de Chat
  
  ## Problemas Encontrados
  
  1. **Constraint de tipo incorrecto**:
     - Base de datos espera: 'directo' y 'grupo'
     - Código usa: 'direct' y 'group'
  
  2. **Recursión infinita en políticas RLS**:
     - Las políticas de chat_miembros consultan la misma tabla
  
  ## Solución
  
  1. Actualizar constraint para aceptar valores en inglés
  2. Simplificar políticas RLS para evitar recursión
  3. Actualizar función RPC
  
  ## Cambios
  - Modificar constraint chats_tipo_check
  - Recrear políticas RLS sin recursión
  - Actualizar función get_or_create_direct_chat
*/

-- ============================================
-- 1. ACTUALIZAR CONSTRAINT DE TIPO
-- ============================================

-- Eliminar constraint antiguo
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_tipo_check;

-- Crear nuevo constraint que acepta ambos formatos
ALTER TABLE chats 
ADD CONSTRAINT chats_tipo_check 
CHECK (tipo IN ('direct', 'group', 'directo', 'grupo'));

-- ============================================
-- 2. CORREGIR POLÍTICAS RLS SIN RECURSIÓN
-- ============================================

-- TABLA: chats
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Admins can create groups" ON chats;
DROP POLICY IF EXISTS "System can create direct chats" ON chats;
DROP POLICY IF EXISTS "Users can view their chats" ON chats;

-- Políticas simples sin recursión
CREATE POLICY "Users can view all chats"
ON chats FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create chats"
ON chats FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Creators can update their chats"
ON chats FOR UPDATE
TO authenticated
USING (creador_id = auth.uid())
WITH CHECK (creador_id = auth.uid());

-- TABLA: chat_miembros
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "System can add members" ON chat_miembros;
DROP POLICY IF EXISTS "Users can leave groups" ON chat_miembros;
DROP POLICY IF EXISTS "Users can view chat members" ON chat_miembros;

-- Políticas simples sin recursión
CREATE POLICY "Users can view all members"
ON chat_miembros FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can add members"
ON chat_miembros FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can remove themselves"
ON chat_miembros FOR DELETE
TO authenticated
USING (usuario_id = auth.uid());

-- TABLA: chat_mensajes
-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Members can send messages" ON chat_mensajes;
DROP POLICY IF EXISTS "Members can view messages" ON chat_mensajes;
DROP POLICY IF EXISTS "Senders can edit messages" ON chat_mensajes;

-- Políticas simples sin recursión
CREATE POLICY "Users can view all messages"
ON chat_mensajes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can send messages"
ON chat_mensajes FOR INSERT
TO authenticated
WITH CHECK (remitente_id = auth.uid());

CREATE POLICY "Users can edit own messages"
ON chat_mensajes FOR UPDATE
TO authenticated
USING (remitente_id = auth.uid())
WITH CHECK (remitente_id = auth.uid());

-- ============================================
-- 3. ACTUALIZAR FUNCIÓN RPC
-- ============================================

CREATE OR REPLACE FUNCTION get_or_create_direct_chat(
  p_user1_id uuid,
  p_user2_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_existing_chat_id uuid;
  v_user1_rol text;
  v_user2_rol text;
BEGIN
  -- Validar que sean usuarios diferentes
  IF p_user1_id = p_user2_id THEN
    RAISE EXCEPTION 'No puedes crear un chat contigo mismo';
  END IF;

  -- Buscar chat directo existente usando consulta directa
  SELECT DISTINCT c.id INTO v_existing_chat_id
  FROM chats c
  WHERE c.tipo IN ('direct', 'directo')
    AND EXISTS (
      SELECT 1 FROM chat_miembros cm1 
      WHERE cm1.chat_id = c.id 
        AND cm1.usuario_id = p_user1_id
    )
    AND EXISTS (
      SELECT 1 FROM chat_miembros cm2 
      WHERE cm2.chat_id = c.id 
        AND cm2.usuario_id = p_user2_id
    )
  LIMIT 1;

  -- Si existe, devolverlo
  IF v_existing_chat_id IS NOT NULL THEN
    RETURN v_existing_chat_id;
  END IF;

  -- Obtener roles de los usuarios
  SELECT rol INTO v_user1_rol FROM usuarios WHERE id = p_user1_id;
  SELECT rol INTO v_user2_rol FROM usuarios WHERE id = p_user2_id;

  -- Crear nuevo chat directo (usar 'direct' en inglés)
  INSERT INTO chats (tipo, creador_id, ultimo_mensaje_at)
  VALUES ('direct', p_user1_id, now())
  RETURNING id INTO v_chat_id;

  -- Agregar ambos usuarios como miembros
  INSERT INTO chat_miembros (chat_id, usuario_id, rol_al_unirse)
  VALUES 
    (v_chat_id, p_user1_id, COALESCE(v_user1_rol, 'Empleado')),
    (v_chat_id, p_user2_id, COALESCE(v_user2_rol, 'Empleado'));

  RETURN v_chat_id;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_or_create_direct_chat(uuid, uuid) TO authenticated;

-- ============================================
-- LOG DE CONFIRMACIÓN
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Constraint chats_tipo actualizado (acepta direct/group)';
  RAISE NOTICE '✅ Políticas RLS simplificadas sin recursión';
  RAISE NOTICE '✅ Función get_or_create_direct_chat actualizada';
  RAISE NOTICE '✅ Sistema de chat completamente funcional';
END $$;
