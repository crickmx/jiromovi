/*
  # Fix whatsapp_messages upsert — replace partial unique index with full unique constraint

  ## Problem
  The existing index `whatsapp_messages_user_wa_id_unique` is a PARTIAL unique index
  (`WHERE wa_message_id IS NOT NULL`). PostgREST/Supabase upsert with `onConflict`
  requires a non-partial unique constraint. As a result, all bulk history upserts from
  the whatsapp-server were silently failing (ignoreDuplicates:true swallowed errors),
  which is why 783 conversations synced but only 3 messages existed in the DB.

  ## Changes
  1. Drop the partial unique index
  2. Create a proper non-partial unique constraint on (user_id, wa_message_id)
     — NULLs are naturally excluded from unique constraint matching in Postgres
     so this is safe; multiple NULLs are still allowed (NULL != NULL)

  ## Note
  This does NOT affect existing data. The 3 messages already in the table all have
  non-null wa_message_id values that will still be covered by the new constraint.
*/

-- Drop the partial unique index that was blocking upserts
DROP INDEX IF EXISTS whatsapp_messages_user_wa_id_unique;

-- Add a proper unique constraint (PostgREST-compatible for onConflict upserts)
-- Postgres allows multiple NULLs in a unique constraint, so rows without wa_message_id
-- can still be inserted freely.
ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_user_wa_message_id_key
  UNIQUE (user_id, wa_message_id);
