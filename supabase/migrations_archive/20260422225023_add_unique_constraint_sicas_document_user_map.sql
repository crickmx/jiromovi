/*
  # Add unique constraint to sicas_document_user_map

  1. Changes
    - Add unique constraint on (movi_user_id, sicas_id_docto) to enable upsert operations
    - This prevents duplicate entries for the same user-document pair

  2. Security
    - No security changes
*/

-- Add unique constraint for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sicas_document_user_map'::regclass
    AND conname = 'sicas_document_user_map_user_docto_unique'
  ) THEN
    ALTER TABLE sicas_document_user_map
    ADD CONSTRAINT sicas_document_user_map_user_docto_unique
    UNIQUE (movi_user_id, sicas_id_docto);
  END IF;
END $$;
