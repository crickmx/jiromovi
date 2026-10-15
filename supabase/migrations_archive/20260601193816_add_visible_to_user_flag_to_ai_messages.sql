/*
  # Add visible_to_user flag to AI message tables

  ## Purpose
  Ensures internal system prompts and technical messages are never shown to users.
  Any message with visible_to_user = false is excluded from UI rendering.

  ## Tables modified
  - `mensajes_chatgpt`: adds `visible_to_user` boolean column
  - `chat_mensajes`: adds `visible_to_user` boolean column

  ## Data changes
  - Marks existing messages containing internal prompt patterns as hidden (visible_to_user = false)
  - These are system messages that were erroneously stored as visible content

  ## Security
  - No RLS changes — existing policies remain in effect
  - Column defaults to true to preserve existing behavior for all valid messages
*/

-- Add visible_to_user to mensajes_chatgpt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mensajes_chatgpt' AND column_name = 'visible_to_user'
  ) THEN
    ALTER TABLE mensajes_chatgpt ADD COLUMN visible_to_user boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add visible_to_user to chat_mensajes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_mensajes' AND column_name = 'visible_to_user'
  ) THEN
    ALTER TABLE chat_mensajes ADD COLUMN visible_to_user boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Hide existing system/internal messages in mensajes_chatgpt
UPDATE mensajes_chatgpt
SET visible_to_user = false
WHERE rol = 'system'
   OR contenido ILIKE '%Eres Chava%'
   OR contenido ILIKE '%Genera un análisis JSON%'
   OR contenido ILIKE '%Responde SOLO con el JSON%'
   OR contenido ILIKE '%CTAs válidos%'
   OR contenido ILIKE '%formato EXACTO%'
   OR contenido ILIKE '%sin markdown, solo JSON%'
   OR contenido ILIKE '%Eres un asistente virtual%';

-- Index for performance on UI queries
CREATE INDEX IF NOT EXISTS idx_mensajes_chatgpt_visible
  ON mensajes_chatgpt (conversacion_id, visible_to_user, created_at);
