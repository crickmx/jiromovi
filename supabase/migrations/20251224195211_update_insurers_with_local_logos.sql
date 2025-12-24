/*
  # Actualizar Aseguradoras con Logos Locales

  ## Descripción
  Actualiza las aseguradoras GNP, Chubb, ANA, Afirme y Allianz con logos 
  de alta calidad almacenados localmente en lugar de usar Clearbit.

  ## Cambios
  1. Actualiza logo_url de GNP Seguros
  2. Actualiza logo_url de Chubb Seguros
  3. Actualiza logo_url de ANA Seguros
  4. Actualiza logo_url de Afirme Seguros
  5. Actualiza logo_url de Allianz

  ## Notas
  - Los logos están almacenados en /public/ y se referencian con rutas absolutas
  - Se mantienen todos los demás datos (website_url, display_order, is_active)
  - Si no existen, se crean con los valores por defecto
*/

-- Actualizar GNP Seguros si existe
UPDATE web_page_insurers
SET logo_url = '/gnp-logo-png_seeklogo-61558.png'
WHERE name = 'GNP Seguros';

-- Crear GNP si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'GNP Seguros', '/gnp-logo-png_seeklogo-61558.png', 'https://www.gnp.com.mx', 2, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'GNP Seguros'
);

-- Actualizar Chubb Seguros si existe
UPDATE web_page_insurers
SET logo_url = '/chubb-logo-png_seeklogo-299281.png'
WHERE name = 'Chubb Seguros';

-- Crear Chubb si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'Chubb Seguros', '/chubb-logo-png_seeklogo-299281.png', 'https://www.chubb.com/mx-es/', 7, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'Chubb Seguros'
);

-- Actualizar ANA Seguros si existe
UPDATE web_page_insurers
SET logo_url = '/ana-seguros-logo-png_seeklogo-187684.png'
WHERE name = 'ANA Seguros';

-- Crear ANA si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'ANA Seguros', '/ana-seguros-logo-png_seeklogo-187684.png', 'https://www.ana.com.mx', 8, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'ANA Seguros'
);

-- Actualizar Afirme Seguros si existe
UPDATE web_page_insurers
SET logo_url = '/afirme-logo-png_seeklogo-4173.png'
WHERE name = 'Afirme Seguros';

-- Crear Afirme si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'Afirme Seguros', '/afirme-logo-png_seeklogo-4173.png', 'https://www.afirme.com', 9, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'Afirme Seguros'
);

-- Actualizar Allianz si existe
UPDATE web_page_insurers
SET logo_url = '/allianz-seguros-logo-png_seeklogo-179147.png'
WHERE name = 'Allianz';

-- Crear Allianz si no existe
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
SELECT 'Allianz', '/allianz-seguros-logo-png_seeklogo-179147.png', 'https://www.allianz.com.mx', 13, true
WHERE NOT EXISTS (
  SELECT 1 FROM web_page_insurers WHERE name = 'Allianz'
);