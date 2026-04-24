/*
  # Fix SICAS sync cursors and clean ghost pagination records

  1. Modified Tables
    - `sicas_sync_cursors`: Add `total_pages` and `is_complete` columns for batch sync tracking
  
  2. Data Cleanup
    - Remove 5 ghost records in `sicas_documents` where pagination metadata was saved as documents
    - These records have id_docto like 'DOC_%' and contain MaxRecords/Pages in raw_data instead of document data

  3. Important Notes
    - The ghost records were caused by SICAS API returning TableControl data inside TableInfo array
    - The new columns enable multi-invocation batch sync (60 pages per call)
*/

-- Add batch tracking columns to sync cursors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_sync_cursors' AND column_name = 'total_pages'
  ) THEN
    ALTER TABLE public.sicas_sync_cursors ADD COLUMN total_pages integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_sync_cursors' AND column_name = 'is_complete'
  ) THEN
    ALTER TABLE public.sicas_sync_cursors ADD COLUMN is_complete boolean DEFAULT false;
  END IF;
END $$;

-- Clean ghost pagination records from sicas_documents
DELETE FROM public.sicas_documents
WHERE id_docto LIKE 'DOC_%'
  AND (
    raw_data::text LIKE '%MaxRecords%'
    OR raw_data::text LIKE '%Pages%'
  )
  AND poliza IS NULL
  AND vend_id IS NULL;

-- Clean ghost records from sicas_polizas_vigentes too
DELETE FROM public.sicas_polizas_vigentes
WHERE id_documento LIKE 'DOC_%'
  AND no_poliza IS NULL
  AND vend_id IS NULL;
