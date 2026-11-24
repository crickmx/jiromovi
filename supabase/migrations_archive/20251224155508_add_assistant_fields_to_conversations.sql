/*
  # Add Assistant Fields to Conversations

  1. Changes
    - Add `es_asistente` boolean field to track if conversation is with the assistant
    - Add `modulo_origen` text field to track which module the conversation was started from
    - Add index on (usuario_id, modulo_origen, es_asistente) for fast lookups

  2. Notes
    - Existing conversations will have es_asistente = false by default
    - modulo_origen can be null for older conversations
*/

-- Add es_asistente column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversaciones_chatgpt' AND column_name = 'es_asistente'
  ) THEN
    ALTER TABLE conversaciones_chatgpt ADD COLUMN es_asistente boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add modulo_origen column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversaciones_chatgpt' AND column_name = 'modulo_origen'
  ) THEN
    ALTER TABLE conversaciones_chatgpt ADD COLUMN modulo_origen text;
  END IF;
END $$;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversaciones_assistant_module
  ON conversaciones_chatgpt(usuario_id, modulo_origen, es_asistente, updated_at DESC);