/*
  # Add source_platform to Chava conversations

  ## Summary
  Adds a `source_platform` column to `chava_agente_conversations` to track which
  platform originated the conversation (movi, seguwallet, or chava_agente).

  ## Changes
  - `chava_agente_conversations`: new `source_platform` column (text, default 'chava_agente')
  - Index for filtering conversations by platform
  - No RLS changes needed — existing policies already scope to chava_user_id

  ## Notes
  - Existing rows default to 'chava_agente'
  - MOVI and Seguwallet platforms tag conversations with 'movi' / 'seguwallet'
  - External Chava Agente users (plataforma_origen = 'externo') only have their
    own auth_user_id and therefore can only read their own conversations regardless
    of platform tag — RLS already enforces this
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chava_agente_conversations' AND column_name = 'source_platform'
  ) THEN
    ALTER TABLE chava_agente_conversations
      ADD COLUMN source_platform text NOT NULL DEFAULT 'chava_agente'
        CHECK (source_platform IN ('movi', 'seguwallet', 'chava_agente'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ca_conv_source_platform
  ON chava_agente_conversations(source_platform);
