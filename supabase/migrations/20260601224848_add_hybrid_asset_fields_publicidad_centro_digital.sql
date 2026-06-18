/*
  # Hybrid Asset Architecture: Publicidad + Centro Digital

  ## Summary
  Adds persistent storage path and thumbnail fields to Publicidad tables
  so rendered images and thumbnails are never lost, and fixes Centro Digital
  storage path convention.

  ## Changes

  ### publicidad_plantillas
  - `thumbnail_url` — public CDN URL of the template thumbnail (nullable)
  - `base_image_storage_path` — Supabase storage path in `publicidad-plantillas` bucket
  - `status` — 'activo' | 'borrador' | 'archivado'

  ### publicidad_disenos
  - `thumbnail_url` — small preview image URL (~400px wide)
  - `rendered_storage_path` — Supabase storage path in `publicidad-disenos` bucket
  - `custom_config_json` — JSON snapshot of text/logo/style used to generate this design
  - `needs_regeneration` — flag when base image changed but render is stale

  ## Notes
  - All new columns are nullable with no defaults to avoid breaking existing rows
  - No data is dropped or modified
*/

-- publicidad_plantillas additions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_plantillas' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE publicidad_plantillas ADD COLUMN thumbnail_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_plantillas' AND column_name = 'base_image_storage_path'
  ) THEN
    ALTER TABLE publicidad_plantillas ADD COLUMN base_image_storage_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_plantillas' AND column_name = 'status'
  ) THEN
    ALTER TABLE publicidad_plantillas ADD COLUMN status text DEFAULT 'activo'
      CHECK (status IN ('activo', 'borrador', 'archivado'));
  END IF;
END $$;

-- publicidad_disenos additions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN thumbnail_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'rendered_storage_path'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN rendered_storage_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'custom_config_json'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN custom_config_json jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'needs_regeneration'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN needs_regeneration boolean DEFAULT false;
  END IF;
END $$;

-- Backfill: copy miniatura_url → thumbnail_url where thumbnail_url is null
UPDATE publicidad_plantillas
SET thumbnail_url = miniatura_url
WHERE thumbnail_url IS NULL AND miniatura_url IS NOT NULL;

-- Backfill: copy archivo_url → thumbnail_url for plantillas still missing it
UPDATE publicidad_plantillas
SET thumbnail_url = archivo_url
WHERE thumbnail_url IS NULL AND archivo_url IS NOT NULL;

-- Backfill: copy archivo_resultante_url → thumbnail_url for existing disenos
UPDATE publicidad_disenos
SET thumbnail_url = archivo_resultante_url
WHERE thumbnail_url IS NULL AND archivo_resultante_url IS NOT NULL;
