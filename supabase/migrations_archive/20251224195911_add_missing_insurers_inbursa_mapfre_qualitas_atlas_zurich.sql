/*
  # Agregar Aseguradoras Faltantes con Logos Locales

  ## Descripción
  Agrega las aseguradoras que faltaban: Inbursa, Mapfre, Qualitas, Atlas y Zurich
  con sus logos locales de alta calidad.

  ## Cambios
  1. Inserta Inbursa Seguros
  2. Inserta Mapfre Seguros
  3. Inserta Qualitas
  4. Inserta Seguros Atlas
  5. Inserta Zurich Seguros

  ## Notas
  - Los logos están almacenados en /public/
  - Solo se insertan si no existen previamente
*/

-- Insertar Inbursa si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'Inbursa', '/inbursa-logo-png_seeklogo-403106.png', 'https://www.inbursa.com', 10, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'Inbursa'
);

-- Insertar Mapfre si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'Mapfre', '/mapfre-seguros-logo-png_seeklogo-225013.png', 'https://www.mapfre.com.mx', 11, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'Mapfre'
);

-- Insertar Qualitas si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'Qualitas', '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png', 'https://www.qualitas.com.mx', 12, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'Qualitas'
);

-- Insertar Seguros Atlas si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'Seguros Atlas', '/seguros-atlas-logo-png_seeklogo-251455.png', 'https://www.segurosatlas.com.mx', 14, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'Seguros Atlas'
);

-- Insertar Zurich si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'Zurich', '/zurich-logo-png_seeklogo-156664.png', 'https://www.zurich.com.mx', 15, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'Zurich'
);