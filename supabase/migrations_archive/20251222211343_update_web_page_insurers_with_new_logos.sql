/*
  # Update web_page_insurers with new insurers
  
  1. Changes
    - Delete all existing insurers from web_page_insurers
    - Insert 5 new insurers with local logo files: GNP Seguros, ANA Seguros, Chubb, Bupa, BX+
  
  2. New Insurers
    - GNP Seguros with /gnp-seguros.png
    - ANA Seguros with /logo_anaseguros.png
    - Chubb with /logo_chubb-04.png
    - Bupa with /logo-bupa.png
    - BX+ with /logo-bx.png
*/

-- Delete all existing insurers
DELETE FROM web_page_insurers;

-- Insert new insurers with logo references
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active) VALUES
  ('GNP Seguros', '/gnp-seguros.png', null, 1, true),
  ('ANA Seguros', '/logo_anaseguros.png', null, 2, true),
  ('Chubb', '/logo_chubb-04.png', null, 3, true),
  ('Bupa', '/logo-bupa.png', null, 4, true),
  ('BX+', '/logo-bx.png', null, 5, true);
