/*
  # Add signature-related fields to oficinas

  1. Modified Tables
    - `oficinas`
      - `color_secundario` (text) - secondary brand color in HEX format
      - `extension` (text) - office phone extension
      - `whatsapp` (text) - office WhatsApp number
      - `sitio_web` (text) - office website URL

  2. Notes
    - These fields support the dynamic email signature system
    - All fields are optional (nullable)
    - color_secundario follows the same HEX format as accent_color
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'color_secundario'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN color_secundario text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'extension'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN extension text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'whatsapp'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN whatsapp text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'oficinas' AND column_name = 'sitio_web'
  ) THEN
    ALTER TABLE oficinas ADD COLUMN sitio_web text DEFAULT '';
  END IF;
END $$;
