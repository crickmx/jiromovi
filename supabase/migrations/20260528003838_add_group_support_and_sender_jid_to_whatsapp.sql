/*
  # Add Group Support to WhatsApp Tables

  ## Summary
  Extends the WhatsApp module to support group conversations and per-message sender tracking.

  ## Changes

  ### whatsapp_conversations
  - `is_group` (boolean, default false) — marks group chats
  - `group_name` (text) — display name for the group
  - `jid` (text) — the full WhatsApp JID (e.g. "521234567890@s.whatsapp.net" or "12345-67890@g.us")

  ### whatsapp_messages
  - `sender_jid` (text) — for group messages, the JID of the participant who sent the message
  - `sender_name` (text) — display name of the sender (for groups)

  ## Notes
  - All columns added with IF NOT EXISTS guards so this is safe to run multiple times
  - No data loss — purely additive schema changes
  - RLS policies unchanged (already correct: user_id = auth.uid())
*/

-- Add group support columns to whatsapp_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'is_group'
  ) THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN is_group boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN group_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_conversations' AND column_name = 'jid'
  ) THEN
    ALTER TABLE whatsapp_conversations ADD COLUMN jid text;
  END IF;
END $$;

-- Add sender tracking columns to whatsapp_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'sender_jid'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN sender_jid text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN sender_name text;
  END IF;
END $$;

-- Index for group conversations
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_is_group
  ON whatsapp_conversations (user_id, is_group);

-- Index for sender lookups in group messages
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender_jid
  ON whatsapp_messages (conversation_id, sender_jid)
  WHERE sender_jid IS NOT NULL;
