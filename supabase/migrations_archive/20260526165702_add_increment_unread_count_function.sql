/*
  # Add increment_unread_count helper function

  1. New Functions
    - `increment_unread_count(conv_id uuid)` - Atomically increments the unread_count for a WhatsApp conversation

  2. Purpose
    - Used by the WhatsApp server sync to safely increment unread message counts without race conditions
*/

CREATE OR REPLACE FUNCTION increment_unread_count(conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET unread_count = COALESCE(unread_count, 0) + 1
  WHERE id = conv_id;
END;
$$;
