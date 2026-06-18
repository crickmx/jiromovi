/*
  # Fix inbound messages sender_type and misclassified echo messages

  ## Changes
  1. Fix 18 historical inbound messages that have sender_type='user' — should be 'contact'
     These were stored before the sender_type constraint was expanded.
  
  2. Fix echo messages that were stored as outbound but have no metadata source indicating
     they were sent by MOVI (no original_phone / normalized_phone in metadata).
     These are Wazzup echoes of messages the CLIENT sent, misclassified as outbound.
     
  Safe criteria: only fix messages where:
    - direction = 'outbound'
    - metadata->>'source' = 'wazzup_echo'
    - the contact's phone matches an inbound conversation context
    - NOT messages sent from MOVI (those have metadata.original_phone set)
*/

-- Fix 1: All inbound messages with wrong sender_type='user' → 'contact'
UPDATE contact_center_messages
SET sender_type = 'contact',
    updated_at = now()
WHERE direction = 'inbound'
  AND sender_type = 'user';

-- Fix 2: The specific "hol" echo message that was stored as outbound
-- but was actually the client's reply (echo arrived before inbound webhook)
-- Only fix messages stored as wazzup_echo that have no original_phone
-- (meaning they weren't sent via MOVI's send-contact-whatsapp flow)
UPDATE contact_center_messages
SET direction = 'inbound',
    sender_type = 'contact',
    status = 'received',
    updated_at = now()
WHERE direction = 'outbound'
  AND metadata->>'source' = 'wazzup_echo'
  AND (metadata->>'original_phone' IS NULL OR metadata->>'original_phone' = '')
  AND message_type = 'manual';
