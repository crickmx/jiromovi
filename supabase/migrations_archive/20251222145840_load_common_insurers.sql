/*
  # Cargar Aseguradoras Comunes de México

  1. Propósito
    - Insertar las aseguradoras más comunes en México en el catálogo web
    - Utiliza logos de Clearbit como placeholder (pueden ser reemplazados después)

  2. Contenido
    - 20 aseguradoras principales del mercado mexicano
    - Logos automáticos mediante Clearbit API
    - Enlaces a sitios web oficiales
    - Orden de visualización predefinido

  3. Notas
    - Los logos pueden ser reemplazados manualmente desde la interfaz de Catálogos Web
    - Todas las aseguradoras se insertan como activas por defecto
*/

-- Insertar aseguradoras comunes de México
INSERT INTO web_page_insurers (name, logo_url, website_url, display_order, is_active)
VALUES
  ('AXA Seguros', 'https://logo.clearbit.com/axa.mx', 'https://www.axa.mx', 1, true),
  ('GNP Seguros', 'https://logo.clearbit.com/gnp.com.mx', 'https://www.gnp.com.mx', 2, true),
  ('Qualitas', 'https://logo.clearbit.com/qualitas.com.mx', 'https://www.qualitas.com.mx', 3, true),
  ('MAPFRE', 'https://logo.clearbit.com/mapfre.com.mx', 'https://www.mapfre.com.mx', 4, true),
  ('Zurich', 'https://logo.clearbit.com/zurich.com.mx', 'https://www.zurich.com.mx', 5, true),
  ('HDI Seguros', 'https://logo.clearbit.com/hdi.com.mx', 'https://www.hdi.com.mx', 6, true),
  ('Chubb Seguros', 'https://logo.clearbit.com/chubb.com', 'https://www.chubb.com/mx-es/', 7, true),
  ('ANA Seguros', 'https://logo.clearbit.com/ana.com.mx', 'https://www.ana.com.mx', 8, true),
  ('Afirme Seguros', 'https://logo.clearbit.com/afirme.com', 'https://www.afirme.com', 9, true),
  ('Seguros Banorte', 'https://logo.clearbit.com/banorte.com', 'https://seguros.banorte.com', 10, true),
  ('Inbursa Seguros', 'https://logo.clearbit.com/inbursa.com', 'https://seguros.inbursa.com', 11, true),
  ('MetLife', 'https://logo.clearbit.com/metlife.com.mx', 'https://www.metlife.com.mx', 12, true),
  ('Allianz', 'https://logo.clearbit.com/allianz.com.mx', 'https://www.allianz.com.mx', 13, true),
  ('Seguros Monterrey New York Life', 'https://logo.clearbit.com/smnyl.com.mx', 'https://www.smnyl.com.mx', 14, true),
  ('Atlas Seguros', 'https://logo.clearbit.com/atlas.com.mx', 'https://www.atlas.com.mx', 15, true),
  ('Primero Seguros', 'https://logo.clearbit.com/primeroseguros.com.mx', 'https://www.primeroseguros.com.mx', 16, true),
  ('Seguros Sura', 'https://logo.clearbit.com/segurossura.com.mx', 'https://www.segurossura.com.mx', 17, true),
  ('ACE Seguros', 'https://logo.clearbit.com/ace-seguros.com.mx', 'https://www.ace-seguros.com.mx', 18, true),
  ('General de Seguros', 'https://logo.clearbit.com/general.com.mx', 'https://www.general.com.mx', 19, true),
  ('Plan Seguro', 'https://logo.clearbit.com/plan-seguro.com.mx', 'https://www.plan-seguro.com.mx', 20, true);
