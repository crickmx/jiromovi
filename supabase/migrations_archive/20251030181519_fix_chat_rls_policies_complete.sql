/*
  # Corrección completa de políticas RLS del módulo de Chat

  ## Problema
  - Políticas RLS duplicadas y conflictivas
  - Algunas políticas muy permisivas (USING true)
  - Políticas que no permiten ver los chats existentes

  ## Solución
  1. Eliminar todas las políticas existentes
  2. Crear políticas claras y específicas
  3. Asegurar que los usuarios solo vean sus chats
  4. Permitir crear y administrar chats correctamente
*/

-- =============================================
-- PASO 1: Eliminar políticas existentes
-- =============================================

DROP POLICY IF EXISTS "Authenticated users can create chats" ON chats;
DROP POLICY IF EXISTS "Crear chats" ON chats;
DROP POLICY IF EXISTS "Users can view all chats" ON chats;
DROP POLICY IF EXISTS "Ver chats donde soy miembro" ON chats;
DROP POLICY IF EXISTS "Creators can update their chats" ON chats;
DROP POLICY IF EXISTS "Actualizar chats donde soy miembro" ON chats;

DROP POLICY IF EXISTS "Authenticated users can add members" ON chat_miembros;
DROP POLICY IF EXISTS "Agregar miembros a chats" ON chat_miembros;
DROP POLICY IF EXISTS "Users can view all members" ON chat_miembros;
DROP POLICY IF EXISTS "Ver miembros de chats donde participo" ON chat_miembros;
DROP POLICY IF EXISTS "Users can remove themselves" ON chat_miembros;

DROP POLICY IF EXISTS "Authenticated users can send messages" ON chat_mensajes;
DROP POLICY IF EXISTS "Enviar mensajes a chats donde soy miembro" ON chat_mensajes;
DROP POLICY IF EXISTS "Users can view all messages" ON chat_mensajes;
DROP POLICY IF EXISTS "Ver mensajes de chats donde soy miembro" ON chat_mensajes;
DROP POLICY IF EXISTS "Users can edit own messages" ON chat_mensajes;
DROP POLICY IF EXISTS "Actualizar mensajes propios" ON chat_mensajes;
DROP POLICY IF EXISTS "Eliminar mensajes propios" ON chat_mensajes;

-- =============================================
-- PASO 2: Políticas para tabla CHATS
-- =============================================

-- SELECT: Ver solo chats donde soy miembro
CREATE POLICY "chats_select_miembro"
  ON chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chats.id
      AND chat_miembros.usuario_id = auth.uid()
    )
  );

-- INSERT: Cualquier usuario autenticado puede crear chats
CREATE POLICY "chats_insert_authenticated"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Solo el creador puede actualizar
CREATE POLICY "chats_update_creador"
  ON chats FOR UPDATE
  TO authenticated
  USING (creador_id = auth.uid())
  WITH CHECK (creador_id = auth.uid());

-- DELETE: Solo el creador puede eliminar
CREATE POLICY "chats_delete_creador"
  ON chats FOR DELETE
  TO authenticated
  USING (creador_id = auth.uid());

-- =============================================
-- PASO 3: Políticas para tabla CHAT_MIEMBROS
-- =============================================

-- SELECT: Ver miembros de chats donde participo
CREATE POLICY "chat_miembros_select_participo"
  ON chat_miembros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_miembros cm
      WHERE cm.chat_id = chat_miembros.chat_id
      AND cm.usuario_id = auth.uid()
    )
  );

-- INSERT: Agregar miembros si soy el creador del chat o si es un chat directo que estoy creando
CREATE POLICY "chat_miembros_insert_creador"
  ON chat_miembros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_miembros.chat_id
      AND chats.creador_id = auth.uid()
    )
    OR
    chat_miembros.usuario_id = auth.uid()
  );

-- UPDATE: Actualizar solo mi propia membresía
CREATE POLICY "chat_miembros_update_propio"
  ON chat_miembros FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- DELETE: Salir del chat (eliminar mi membresía)
CREATE POLICY "chat_miembros_delete_propio"
  ON chat_miembros FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

-- =============================================
-- PASO 4: Políticas para tabla CHAT_MENSAJES
-- =============================================

-- SELECT: Ver mensajes de chats donde soy miembro
CREATE POLICY "chat_mensajes_select_miembro"
  ON chat_mensajes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chat_mensajes.chat_id
      AND chat_miembros.usuario_id = auth.uid()
    )
  );

-- INSERT: Enviar mensajes a chats donde soy miembro
CREATE POLICY "chat_mensajes_insert_miembro"
  ON chat_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (
    remitente_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_miembros
      WHERE chat_miembros.chat_id = chat_mensajes.chat_id
      AND chat_miembros.usuario_id = auth.uid()
    )
  );

-- UPDATE: Actualizar solo mis mensajes
CREATE POLICY "chat_mensajes_update_propio"
  ON chat_mensajes FOR UPDATE
  TO authenticated
  USING (remitente_id = auth.uid())
  WITH CHECK (remitente_id = auth.uid());

-- DELETE: Eliminar solo mis mensajes
CREATE POLICY "chat_mensajes_delete_propio"
  ON chat_mensajes FOR DELETE
  TO authenticated
  USING (remitente_id = auth.uid());

-- =============================================
-- PASO 5: Verificar función get_or_create_direct_chat
-- =============================================

CREATE OR REPLACE FUNCTION get_or_create_direct_chat(
  p_user1_id uuid,
  p_user2_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chat_id uuid;
BEGIN
  -- Buscar chat directo existente entre estos dos usuarios
  SELECT c.id INTO v_chat_id
  FROM chats c
  WHERE c.tipo = 'direct'
    AND EXISTS (
      SELECT 1 FROM chat_miembros cm1
      WHERE cm1.chat_id = c.id AND cm1.usuario_id = p_user1_id
    )
    AND EXISTS (
      SELECT 1 FROM chat_miembros cm2
      WHERE cm2.chat_id = c.id AND cm2.usuario_id = p_user2_id
    )
    AND (
      SELECT COUNT(*) FROM chat_miembros
      WHERE chat_miembros.chat_id = c.id
    ) = 2
  LIMIT 1;

  -- Si existe, retornar el ID
  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  -- Si no existe, crear nuevo chat
  INSERT INTO chats (tipo, creador_id, ultimo_mensaje_at)
  VALUES ('direct', p_user1_id, now())
  RETURNING id INTO v_chat_id;

  -- Agregar ambos usuarios como miembros
  INSERT INTO chat_miembros (chat_id, usuario_id, unido_at)
  VALUES 
    (v_chat_id, p_user1_id, now()),
    (v_chat_id, p_user2_id, now());

  RETURN v_chat_id;
END;
$$;

-- Comentarios
COMMENT ON POLICY "chats_select_miembro" ON chats IS 'Usuarios pueden ver solo los chats donde son miembros';
COMMENT ON POLICY "chat_miembros_select_participo" ON chat_miembros IS 'Usuarios pueden ver miembros de chats donde participan';
COMMENT ON POLICY "chat_mensajes_select_miembro" ON chat_mensajes IS 'Usuarios pueden ver mensajes de chats donde son miembros';
COMMENT ON FUNCTION get_or_create_direct_chat IS 'Obtiene o crea un chat directo entre dos usuarios';
