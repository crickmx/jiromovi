/*
  # seguros.express — Extensiones de geolocalización (Parte C.1)

  Habilita `cube` y `earthdistance` para calcular distancia en km entre dos
  puntos (lat/lng) sin necesidad de PostGIS. `earthdistance` depende de `cube`.

  Aditivo: no toca ningún objeto existente. Ambas se instalan en el esquema
  `extensions` (convención Supabase, mismo lugar que pg_trgm/unaccent/etc.).
  Las funciones que las usan declaran `search_path = public, extensions`.
*/

CREATE EXTENSION IF NOT EXISTS cube WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS earthdistance WITH SCHEMA extensions;
