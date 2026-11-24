/*
  # Corregir Constraint de Rol en chat_miembros
  
  ## Problema
  El constraint espera: 'admin', 'miembro'
  Pero la columna rol_al_unirse tiene: 'Administrador', 'Gerente', etc.
  
  ## Solución
  - Eliminar constraint de la columna 'rol' (solo para admin del chat)
  - La columna 'rol_al_unirse' no debe tener constraint
  
  ## Cambios
  1. Eliminar constraint chat_miembros_rol_check
  2. Permitir cualquier valor en ambas columnas
*/

-- Eliminar constraint restrictivo
ALTER TABLE chat_miembros 
DROP CONSTRAINT IF EXISTS chat_miembros_rol_check;

-- Actualizar función RPC para usar valores correctos
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
BEGIN
  -- Validar que sean usuarios diferentes
  IF p_user1_id = p_user2_id THEN
    RAISE EXCEPTION 'No puedes crear un chat contigo mismo';
  END IF;

  -- Buscar chat directo existente
  SELECT DISTINCT c.id INTO v_existing_chat_id
  FROM chats c
  INNER JOIN chat_miembros cm1 ON cm1.chat_id = c.id AND cm1.usuario_id = p_user1_id
  INNER JOIN chat_miembros cm2 ON cm2.chat_id = c.id AND cm2.usuario_id = p_user2_id
  WHERE c.tipo IN ('direct', 'directo')
    AND (SELECT COUNT(*) FROM chat_miembros cm WHERE cm.chat_id = c.id) = 2
  LIMIT 1;

  -- Si existe, devolverlo
  IF v_existing_chat_id IS NOT NULL THEN
    RETURN v_existing_chat_id;
  END IF;

  -- Crear nuevo chat directo
  INSERT INTO chats (tipo, creador_id, ultimo_mensaje_at)
  VALUES ('direct', p_user1_id, now())
  RETURNING id INTO v_chat_id;

  -- Agregar ambos usuarios como miembros
  -- rol = 'miembro' (para el sistema de permisos del chat)
  -- rol_al_unirse = rol del usuario en la empresa
  INSERT INTO chat_miembros (chat_id, usuario_id, rol, rol_al_unirse)
  SELECT 
    v_chat_id,
    u.id,
    'miembro',
    u.rol
  FROM usuarios u
  WHERE u.id IN (p_user1_id, p_user2_id);

  RETURN v_chat_id;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION get_or_create_direct_chat(uuid, uuid) TO authenticated;

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Constraint rol eliminado de chat_miembros';
  RAISE NOTICE '✅ Función get_or_create_direct_chat actualizada';
  RAISE NOTICE '✅ Ahora usa rol=miembro y rol_al_unirse=rol del usuario';
END $$;
