/*
  # Add logo URL field to cat_aseguradoras and update with new insurers
  
  1. Changes
    - Add logo_url field to cat_aseguradoras table
    - Delete all existing insurers
    - Insert 5 new insurers with logos: GNP Seguros, ANA Seguros, Chubb, Bupa, BX+
  
  2. New Field
    - `logo_url` (text, nullable) - URL to the insurer's logo image
*/

-- Add logo_url column
ALTER TABLE cat_aseguradoras ADD COLUMN IF NOT EXISTS logo_url text;

-- Delete all existing records
DELETE FROM cat_aseguradoras;

-- Insert new insurers with logo references
INSERT INTO cat_aseguradoras (nombre, logo_url, activo) VALUES
  ('GNP Seguros', '/gnp-seguros.png', true),
  ('ANA Seguros', '/logo_anaseguros.png', true),
  ('Chubb', '/logo_chubb-04.png', true),
  ('Bupa', '/logo-bupa.png', true),
  ('BX+', '/logo-bx.png', true);
