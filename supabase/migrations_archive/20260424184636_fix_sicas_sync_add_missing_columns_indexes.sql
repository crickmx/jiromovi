/*
  # Fix SICAS sync - Add missing columns and indexes

  1. Schema Changes
    - Add `desp_id` text column to sicas_documents (despacho ID from SICAS)
    - Add `oficina_nombre` text column to sicas_documents (office name from SICAS)
    - Add `records_linked` integer column to sicas_sync_runs (count of docs linked to users)
    
  2. Indexes
    - Add index on sicas_documents(vend_id) WHERE usuario_id IS NULL for fast unmapped lookup
    
  3. Notes
    - Most columns already exist from previous migrations
    - This migration adds only what's missing for the new sync strategy
*/

-- Add desp_id if missing (the raw_data has IDDesp but we weren't storing it separately)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_documents' AND column_name = 'desp_id'
  ) THEN
    ALTER TABLE sicas_documents ADD COLUMN desp_id text;
  END IF;
END $$;

-- Add oficina_nombre if missing (from SICAS OfnaNombre field)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_documents' AND column_name = 'oficina_nombre'
  ) THEN
    ALTER TABLE sicas_documents ADD COLUMN oficina_nombre text;
  END IF;
END $$;

-- Add records_linked to sync runs for tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sicas_sync_runs' AND column_name = 'records_linked'
  ) THEN
    ALTER TABLE sicas_sync_runs ADD COLUMN records_linked integer DEFAULT 0;
  END IF;
END $$;

-- Index for finding unmapped documents efficiently
CREATE INDEX IF NOT EXISTS idx_sicas_docs_unmapped_vend
  ON sicas_documents (vend_id)
  WHERE usuario_id IS NULL AND vend_id IS NOT NULL;
