/*
  # Add AI Knowledge Fields to Centro Digital Folders

  1. Modified Tables
    - `centro_digital_carpetas`
      - `enable_chava_ai` (boolean, default false) - Whether folder contents are available to Chava AI for RAG queries
      - `external_chava_access` (boolean, default false) - Whether external users (Seguwallet, public) can access this knowledge
      - `auto_index` (boolean, default true) - Whether new documents are automatically indexed/embedded
      - `knowledge_priority` (integer, default 1) - Priority weight 1-5 for search result ranking

  2. Notes
    - These fields prepare Centro Digital to serve as the unified knowledge repository for Chava AI
    - `auto_index` defaults to true so new documents are processed without manual intervention
    - `enable_chava_ai` defaults to false to avoid exposing existing folders without explicit opt-in
    - `knowledge_priority` allows admins to boost important folders in search results
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_digital_carpetas' AND column_name = 'enable_chava_ai'
  ) THEN
    ALTER TABLE centro_digital_carpetas ADD COLUMN enable_chava_ai boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_digital_carpetas' AND column_name = 'external_chava_access'
  ) THEN
    ALTER TABLE centro_digital_carpetas ADD COLUMN external_chava_access boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_digital_carpetas' AND column_name = 'auto_index'
  ) THEN
    ALTER TABLE centro_digital_carpetas ADD COLUMN auto_index boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'centro_digital_carpetas' AND column_name = 'knowledge_priority'
  ) THEN
    ALTER TABLE centro_digital_carpetas ADD COLUMN knowledge_priority integer DEFAULT 1;
  END IF;
END $$;

COMMENT ON COLUMN centro_digital_carpetas.enable_chava_ai IS 'Whether folder contents are available to Chava AI for RAG queries';
COMMENT ON COLUMN centro_digital_carpetas.external_chava_access IS 'Whether external users (Seguwallet, public) can query this knowledge';
COMMENT ON COLUMN centro_digital_carpetas.auto_index IS 'Whether new documents are automatically chunked and embedded';
COMMENT ON COLUMN centro_digital_carpetas.knowledge_priority IS 'Priority weight 1-5 for search result ranking (higher = more relevant)';
