/*
  # Agregar campo channel_id_uuid para Wazzup24

  1. Cambios
    - Agregar columna channel_id_uuid para almacenar el UUID del canal de Wazzup24
    - Este UUID es el identificador único del canal en Wazzup24, no el número de teléfono
    - Se obtiene del dashboard de Wazzup24 en la sección "Channels"
  
  2. Notas
    - channelId debe ser UUID formato: "24197d5f-06de-421f-8576-9f6e6cb67f28"
    - NO es el número de teléfono
    - Es obligatorio para enviar mensajes por Wazzup24 API v3
*/

-- Agregar columna para UUID del canal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'whatsapp_configuracion' 
    AND column_name = 'channel_id_uuid'
  ) THEN
    ALTER TABLE whatsapp_configuracion 
    ADD COLUMN channel_id_uuid text;
  END IF;
END $$;

-- Agregar comentario explicativo
COMMENT ON COLUMN whatsapp_configuracion.channel_id_uuid IS 
'UUID del canal de Wazzup24. Se obtiene del dashboard en la sección "Channels". Formato: UUID (ejemplo: 24197d5f-06de-421f-8576-9f6e6cb67f28)';

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_whatsapp_channel_uuid 
ON whatsapp_configuracion(channel_id_uuid) 
WHERE activo = true;
