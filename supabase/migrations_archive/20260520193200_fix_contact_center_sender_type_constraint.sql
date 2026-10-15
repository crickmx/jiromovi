/*
  # Fix contact_center_messages sender_type constraint

  ## Problem
  The wazzup-webhook function stores inbound messages with sender_type='contact',
  but the DB check constraint only allows 'user' and 'system'. This silently blocks
  ALL inbound WhatsApp messages from being saved.

  ## Fix
  Expand the constraint to also allow 'contact' and 'bot'.
*/

ALTER TABLE contact_center_messages
  DROP CONSTRAINT IF EXISTS contact_center_messages_sender_type_check;

ALTER TABLE contact_center_messages
  ADD CONSTRAINT contact_center_messages_sender_type_check
  CHECK (sender_type = ANY (ARRAY['user'::text, 'system'::text, 'contact'::text, 'bot'::text]));
