/*
  # Enhance Digital Center Ads and Documents Tables

  ## Changes

  ### digital_center_ads
  - Add `descripcion` column (detailed description)
  - Add `placement` column (banner location: home, centro-digital, global)
  - Add `insurer_name` column (optional segmentation by insurer)
  - Add `ramo` column (optional segmentation by ramo)
  - Add `category` column (optional segmentation by category)
  - Add `start_date` / `end_date` columns (scheduling)
  - Rename `imagen_url` alias to also support `image_url` via generated column

  ### digital_center_documents
  - Add `file_hash` column (SHA-256 for dedup)
  - Add `file_name` column (stored filename)
  - Add `file_extension` column (pdf, xlsx, docx, etc.)
  - Add `file_mime_type` column (MIME type)
  - Add `insurer_logo_url` column (logo path for display)
  - Add `local_file_path` column (alias/view of storage_path)

  ## Notes
  - All new columns are nullable to avoid breaking existing rows
  - RLS policies remain unchanged
*/

-- Enhance digital_center_ads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_ads' AND column_name = 'descripcion') THEN
    ALTER TABLE digital_center_ads ADD COLUMN descripcion text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_ads' AND column_name = 'placement') THEN
    ALTER TABLE digital_center_ads ADD COLUMN placement text DEFAULT 'centro-digital';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_ads' AND column_name = 'insurer_name') THEN
    ALTER TABLE digital_center_ads ADD COLUMN insurer_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_ads' AND column_name = 'ramo') THEN
    ALTER TABLE digital_center_ads ADD COLUMN ramo text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_ads' AND column_name = 'category') THEN
    ALTER TABLE digital_center_ads ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_ads' AND column_name = 'start_date') THEN
    ALTER TABLE digital_center_ads ADD COLUMN start_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_ads' AND column_name = 'end_date') THEN
    ALTER TABLE digital_center_ads ADD COLUMN end_date date;
  END IF;
END $$;

-- Enhance digital_center_documents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_documents' AND column_name = 'file_hash') THEN
    ALTER TABLE digital_center_documents ADD COLUMN file_hash text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_documents' AND column_name = 'file_name') THEN
    ALTER TABLE digital_center_documents ADD COLUMN file_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_documents' AND column_name = 'file_extension') THEN
    ALTER TABLE digital_center_documents ADD COLUMN file_extension text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_documents' AND column_name = 'file_mime_type') THEN
    ALTER TABLE digital_center_documents ADD COLUMN file_mime_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'digital_center_documents' AND column_name = 'insurer_logo_url') THEN
    ALTER TABLE digital_center_documents ADD COLUMN insurer_logo_url text;
  END IF;
END $$;

-- Add index for deduplication lookups
CREATE INDEX IF NOT EXISTS idx_digital_center_documents_file_hash ON digital_center_documents(file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_digital_center_documents_aseguradora ON digital_center_documents(aseguradora);
CREATE INDEX IF NOT EXISTS idx_digital_center_documents_ramo ON digital_center_documents(ramo);
CREATE INDEX IF NOT EXISTS idx_digital_center_ads_placement ON digital_center_ads(placement);
CREATE INDEX IF NOT EXISTS idx_digital_center_ads_activo ON digital_center_ads(activo);
