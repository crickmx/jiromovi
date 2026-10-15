-- RPC functions to return distinct catalog values efficiently
-- Avoids pulling all rows client-side (which hits Supabase's 1000-row default limit)

CREATE OR REPLACE FUNCTION get_catalog_marcas()
RETURNS TABLE(marca text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT v.marca
  FROM multi_autos_catalogo_vehiculos v
  ORDER BY v.marca;
$$;

CREATE OR REPLACE FUNCTION get_catalog_anios(p_marca text)
RETURNS TABLE(anio integer)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT v.anio
  FROM multi_autos_catalogo_vehiculos v
  WHERE v.marca = p_marca
  ORDER BY v.anio DESC;
$$;

CREATE OR REPLACE FUNCTION get_catalog_modelos(p_marca text, p_anio integer)
RETURNS TABLE(modelo text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT v.modelo
  FROM multi_autos_catalogo_vehiculos v
  WHERE v.marca = p_marca AND v.anio = p_anio
  ORDER BY v.modelo;
$$;
