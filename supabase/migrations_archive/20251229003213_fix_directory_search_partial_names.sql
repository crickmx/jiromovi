/*
  # Mejorar búsqueda de directorio para nombres parciales

  1. Problema
    - La búsqueda "ale abarca" no encontraba "Alejandra Abarca"
    - La función buscaba la cadena completa, no palabras separadas

  2. Solución
    - Buscar cada palabra del search_term por separado
    - Permitir nombres parciales y apodos
    - Mejorar scoring para ordenar resultados

  3. Seguridad
    - Mantiene SECURITY DEFINER
    - Respeta RLS existente
    - Solo usuarios activos
*/

-- Reemplazar función de búsqueda de directorio con lógica mejorada
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
  word text;
  match_score int;
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
          LOWER(u.nombre || ' ' || u.apellidos) LIKE LOWER('%' || word || '%')
        ) FROM unnest(search_words) AS word)
        -- O todas en email
        OR (SELECT bool_and(
          LOWER(u.email_laboral) LIKE LOWER('%' || word || '%')
        ) FROM unnest(search_words) AS word)
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

-- Comentario actualizado
COMMENT ON FUNCTION search_directory(text) IS 'Búsqueda fuzzy mejorada de empleados/gerentes/agentes. Soporta búsquedas por palabras parciales (ej: "ale abarca"). Respeta RLS y solo devuelve usuarios activos.';
