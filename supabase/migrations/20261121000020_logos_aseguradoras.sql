-- ============================================================================
-- Logotipos oficiales de las aseguradoras
--
-- La portada automática del Aula Virtual pinta el logotipo real de la
-- aseguradora cuando existe en la base. Los activos ya viven en
-- `public/` del repo (son los mismos que usa el Multicotizador GMM), así que
-- solo faltaba enlazarlos. Las que no tienen activo se quedan en NULL: la
-- portada escribe entonces el nombre, que es el comportamiento previsto.
-- ============================================================================

update public.aseguradoras set logo_url = v.logo
from (values
  ('Afirme Seguros',  '/afirme-logo-png_seeklogo-4173.png'),
  ('Allianz',         '/allianz-seguros-logo-png_seeklogo-179147.png'),
  ('ANA Seguros',     '/ana-seguros-logo-png_seeklogo-187684.png'),
  ('Bupa',            '/logo-bupa.png'),
  ('Chubb Seguros',   '/chubb-logo-png_seeklogo-299281.png'),
  ('GNP Seguros',     '/gnp-seguros.png'),
  ('Inbursa',         '/inbursa-logo-png_seeklogo-403106.png'),
  ('MAPFRE',          '/mapfre-seguros-logo-png_seeklogo-225013.png'),
  ('Qualitas',        '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png'),
  ('Seguros Atlas',   '/seguros-atlas-logo-png_seeklogo-251455.png'),
  ('Zurich Seguros',  '/zurich-logo-png_seeklogo-156664.png')
) as v(nombre, logo)
where public.aseguradoras.nombre = v.nombre
  and (public.aseguradoras.logo_url is null or public.aseguradoras.logo_url = '');