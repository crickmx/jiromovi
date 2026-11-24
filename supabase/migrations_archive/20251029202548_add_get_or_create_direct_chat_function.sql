/*
  # Agregar Función RPC para Crear Chats Directos
  
  ## Problema
  El modal de Nuevo Chat llama a una función RPC que no existe:
  `get_or_create_direct_chat`
  
  ## Solución
  Crear la función RPC que:
  - Busca si ya existe un chat directo entre dos usuarios
  - Si existe, lo devuelve
  - Si no existe, crea uno nuevo y agrega ambos usuarios como miembros
  
  ## Funcionalidad
  1. Verifica que no exista un chat directo entre los dos usuarios
  2. Si existe, devuelve el ID del chat existente
  3. Si no existe:
     - Crea un nuevo chat tipo 'direct'
     - Agrega ambos usuarios como miembros
     - Devuelve el ID del nuevo chat
*/

-- Función para obtener o crear un chat directo entre dos usuarios
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
  v_existing_chat_id uuid;
  v_user1_rol text;
  v_user2_rol text;
BEGIN
  -- Verificar que los usuarios sean diferentes
  IF p_user1_id = p_user2_id THEN
    RAISE EXCEPTION 'No puedes crear un chat contigo mismo';
  END IF;

  -- Buscar si ya existe un chat directo entre estos usuarios
  SELECT c.id INTO v_existing_chat_id
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
      SELECT COUNT(*) FROM chat_miembros cm 
      WHERE cm.chat_id = c.id
    ) = 2
  LIMIT 1;

  -- Si ya existe, devolverlo
  IF v_existing_chat_id IS NOT NULL THEN
    RETURN v_existing_chat_id;
  END IF;

  -- Obtener roles de los usuarios
  SELECT rol INTO v_user1_rol FROM usuarios WHERE id = p_user1_id;
  SELECT rol INTO v_user2_rol FROM usuarios WHERE id = p_user2_id;

  -- Crear nuevo chat directo
  INSERT INTO chats (tipo, creador_id)
  VALUES ('direct', p_user1_id)
  RETURNING id INTO v_chat_id;

  -- Agregar ambos usuarios como miembros
  INSERT INTO chat_miembros (chat_id, usuario_id, rol_al_unirse)
  VALUES 
    (v_chat_id, p_user1_id, v_user1_rol),
    (v_chat_id, p_user2_id, v_user2_rol);

  RETURN v_chat_id;
END;
$$;

-- Dar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_or_create_direct_chat(uuid, uuid) TO authenticated;

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Función get_or_create_direct_chat creada';
  RAISE NOTICE '✅ Los usuarios pueden crear chats directos';
  RAISE NOTICE '✅ Se evita duplicar chats entre los mismos usuarios';
END $$;
