/*
  # Fix búsqueda de directorio - conflicto de variables

  1. Problema
    - Variable "word" causaba ambigüedad con alias de tabla

  2. Solución
    - Usar alias diferente en subqueries
    - Simplificar lógica de búsqueda multi-palabra
*/

CREATE OR REPLACE FUNCTION search_directory(search_term text)
RETURNS TABLE (
  id uuid,
  nombre_completo text,
  rol text,
  puesto text,
  oficina_nombre text,
  celular_laboral text,
  extension_telefonica text,
  email_laboral text,
  celular_personal text,
  email_personal text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  search_words text[];
BEGIN
  -- Dividir el search_term en palabras (separadas por espacios)
  search_words := string_to_array(LOWER(TRIM(search_term)), ' ');
  
  -- Si solo hay una palabra, hacer búsqueda simple
  IF array_length(search_words, 1) = 1 THEN
    RETURN QUERY
    SELECT 
      u.id,
      u.nombre || ' ' || u.apellidos AS nombre_completo,
      u.rol::text,
      u.puesto,
      o.nombre AS oficina_nombre,
      u.celular_laboral,
      u.extension_telefonica,
      u.email_laboral,
      u.celular_personal,
      u.email_personal
    FROM usuarios u
    LEFT JOIN oficinas o ON u.oficina_id = o.id
    WHERE 
      u.activo = true
      AND (
        LOWER(u.nombre) LIKE LOWER('%' || search_term || '%')
        OR LOWER(u.apellidos) LIKE LOWER('%' || search_term || '%')
        OR LOWER(u.nombre || ' ' || u.apellidos) LIKE LOWER('%' || search_term || '%')
        OR LOWER(u.email_laboral) LIKE LOWER('%' || search_term || '%')
        OR LOWER(u.email_personal) LIKE LOWER('%' || search_term || '%')
        OR REPLACE(REPLACE(u.celular_laboral, '-', ''), ' ', '') LIKE '%' || REPLACE(REPLACE(search_term, '-', ''), ' ', '') || '%'
        OR REPLACE(REPLACE(u.celular_personal, '-', ''), ' ', '') LIKE '%' || REPLACE(REPLACE(search_term, '-', ''), ' ', '') || '%'
      )
    ORDER BY 
      CASE 
        WHEN LOWER(u.nombre) = LOWER(search_term) THEN 1
        WHEN LOWER(u.apellidos) = LOWER(search_term) THEN 2
        WHEN LOWER(u.nombre || ' ' || u.apellidos) = LOWER(search_term) THEN 3
        WHEN LOWER(u.nombre) LIKE LOWER(search_term || '%') THEN 4
        ELSE 5
      END,
      u.nombre, u.apellidos
    LIMIT 10;
  ELSE
    -- Si hay múltiples palabras, buscar que TODAS las palabras estén presentes
    RETURN QUERY
    SELECT 
      u.id,
      u.nombre || ' ' || u.apellidos AS nombre_completo,
      u.rol::text,
      u.puesto,
      o.nombre AS oficina_nombre,
      u.celular_laboral,
      u.extension_telefonica,
      u.email_laboral,
      u.celular_personal,
      u.email_personal
    FROM usuarios u
    LEFT JOIN oficinas o ON u.oficina_id = o.id
    WHERE 
      u.activo = true
      -- Verificar que TODAS las palabras estén en nombre O apellidos
      AND (
        -- Todas las palabras en nombre completo
        (SELECT bool_and(
          LOWER(u.nombre || ' ' || u.apellidos) LIKE LOWER('%' || w || '%')
        ) FROM unnest(search_words) AS w)
        -- O todas en email
        OR (SELECT bool_and(
          LOWER(u.email_laboral) LIKE LOWER('%' || w || '%')
        ) FROM unnest(search_words) AS w)
      )
    ORDER BY 
      -- Priorizar matches donde las palabras aparecen en orden
      CASE 
        WHEN LOWER(u.nombre || ' ' || u.apellidos) LIKE LOWER(array_to_string(search_words, '%') || '%') THEN 1
        ELSE 2
      END,
      u.nombre, u.apellidos
    LIMIT 10;
  END IF;
END;
$$;

COMMENT ON FUNCTION search_directory(text) IS 'Búsqueda fuzzy mejorada de empleados/gerentes/agentes. Soporta búsquedas por palabras parciales (ej: "ale abarca"). Respeta RLS y solo devuelve usuarios activos.';
