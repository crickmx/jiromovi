/*
  # Add AI Copy Fields to Publicidad Disenos

  1. Modified Tables
    - `publicidad_disenos`
      - `ai_copy` (jsonb) - Structured AI-generated copy with fields: apertura, desarrollo, cta, firma, url_web, hashtags
      - `ai_copy_generated_at` (timestamptz) - When the copy was last generated
      - `ai_copy_version` (integer) - Version counter for regeneration tracking
      - `ai_copy_editado_manual` (boolean) - Whether user manually edited the copy
      - `ai_copy_original` (jsonb) - Preserved original AI copy before manual edits
      - `ai_copy_modelo` (text) - AI model used for generation
      - `ai_copy_metadata` (jsonb) - Additional metadata (tokens used, brand context used, etc.)

  2. Purpose
    - Enable AI-generated marketing copy for each personalized design
    - Support manual editing while preserving AI original for restore
    - Track generation history and quality metrics
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'ai_copy'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN ai_copy jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'ai_copy_generated_at'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN ai_copy_generated_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'ai_copy_version'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN ai_copy_version integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'ai_copy_editado_manual'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN ai_copy_editado_manual boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'ai_copy_original'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN ai_copy_original jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'ai_copy_modelo'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN ai_copy_modelo text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'publicidad_disenos' AND column_name = 'ai_copy_metadata'
  ) THEN
    ALTER TABLE publicidad_disenos ADD COLUMN ai_copy_metadata jsonb DEFAULT NULL;
  END IF;
END $$;
