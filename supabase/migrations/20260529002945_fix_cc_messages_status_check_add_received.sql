/*
  # Fix cc_messages status check constraint

  1. Changes
    - Add 'received' to the allowed status values in cc_messages_status_check
    - This allows the sync trigger to copy inbound WhatsApp messages that have status='received'

  2. Problem
    - The trg_cc_sync_wazzup trigger copies messages from contact_center_messages to cc_messages
    - Inbound messages have status='received' which was not in the cc_messages check constraint
    - This caused inserts to fail silently, preventing inbound messages from being stored
*/

ALTER TABLE cc_messages DROP CONSTRAINT IF EXISTS cc_messages_status_check;
ALTER TABLE cc_messages ADD CONSTRAINT cc_messages_status_check
  CHECK (status = ANY (ARRAY['pending','sent','delivered','read','failed','received']));
