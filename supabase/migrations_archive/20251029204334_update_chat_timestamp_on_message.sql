/*
  # Actualizar Timestamp de Chat Automáticamente
  
  ## Funcionalidad
  Cuando se inserta un mensaje en chat_mensajes, actualizar
  automáticamente el campo ultimo_mensaje_at del chat correspondiente
  
  ## Beneficio
  - Mantiene actualizado el timestamp del último mensaje
  - Permite ordenar chats por actividad reciente
  - Se ejecuta automáticamente, no requiere lógica en frontend
*/

-- Función para actualizar timestamp del chat
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar ultimo_mensaje_at del chat
  UPDATE chats
  SET ultimo_mensaje_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.chat_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS update_chat_timestamp_trigger ON chat_mensajes;

-- Crear trigger que se ejecuta después de insertar un mensaje
CREATE TRIGGER update_chat_timestamp_trigger
AFTER INSERT ON chat_mensajes
FOR EACH ROW
EXECUTE FUNCTION update_chat_timestamp();

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger creado: update_chat_timestamp_trigger';
  RAISE NOTICE '✅ Los chats se actualizan automáticamente con cada mensaje';
  RAISE NOTICE '✅ El campo ultimo_mensaje_at se mantiene sincronizado';
END $$;
