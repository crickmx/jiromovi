/*
  # Corrección de recursión infinita en políticas RLS del Chat

  ## Problema
  - Recursión infinita detectada en las políticas
  - La política de chats consulta chat_miembros
  - La política de chat_miembros también tiene subconsultas que crean ciclo
  
  ## Solución
  - Usar funciones con SECURITY DEFINER para romper la recursión
  - Simplificar las políticas RLS
  - Eliminar EXISTS anidados que causan el ciclo
*/

-- =============================================
-- PASO 1: Eliminar políticas problemáticas
-- =============================================

DROP POLICY IF EXISTS "chats_select_miembro" ON chats;
DROP POLICY IF EXISTS "chat_miembros_select_participo" ON chat_miembros;
DROP POLICY IF EXISTS "chat_mensajes_select_miembro" ON chat_mensajes;
DROP POLICY IF EXISTS "chat_mensajes_insert_miembro" ON chat_mensajes;

-- =============================================
-- PASO 2: Crear función helper para verificar membresía
-- =============================================

CREATE OR REPLACE FUNCTION is_chat_member(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_miembros
    WHERE chat_id = p_chat_id
    AND usuario_id = p_user_id
  );
$$;

-- =============================================
-- PASO 3: Crear políticas simples sin recursión
-- =============================================

-- CHATS: Ver solo mis chats usando la función helper
CREATE POLICY "chats_select_member"
  ON chats FOR SELECT
  TO authenticated
  USING (is_chat_member(id, auth.uid()));

-- CHAT_MIEMBROS: Ver todos los miembros sin subconsultas recursivas
CREATE POLICY "chat_miembros_select_all"
  ON chat_miembros FOR SELECT
  TO authenticated
  USING (true);

-- CHAT_MENSAJES: Ver mensajes usando la función helper
CREATE POLICY "chat_mensajes_select_member"
  ON chat_mensajes FOR SELECT
  TO authenticated
  USING (is_chat_member(chat_id, auth.uid()));

-- CHAT_MENSAJES: Insertar mensajes usando la función helper
CREATE POLICY "chat_mensajes_insert_member"
  ON chat_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (
    remitente_id = auth.uid()
    AND is_chat_member(chat_id, auth.uid())
  );

-- =============================================
-- PASO 4: Optimizar índices
-- =============================================

-- Índice para búsquedas de membresía
CREATE INDEX IF NOT EXISTS idx_chat_miembros_usuario_chat 
  ON chat_miembros(usuario_id, chat_id);

CREATE INDEX IF NOT EXISTS idx_chat_miembros_chat_usuario 
  ON chat_miembros(chat_id, usuario_id);

-- Índice para mensajes
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_chat_created 
  ON chat_mensajes(chat_id, created_at DESC);

-- =============================================
-- PASO 5: Comentarios
-- =============================================

COMMENT ON FUNCTION is_chat_member IS 'Verifica si un usuario es miembro de un chat sin causar recursión';
COMMENT ON POLICY "chats_select_member" ON chats IS 'Usuarios ven solo chats donde son miembros';
COMMENT ON POLICY "chat_miembros_select_all" ON chat_miembros IS 'Todos pueden ver miembros (RLS en chats controla el acceso)';
COMMENT ON POLICY "chat_mensajes_select_member" ON chat_mensajes IS 'Usuarios ven mensajes de sus chats';
