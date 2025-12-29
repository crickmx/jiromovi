/*
  # Crear función de búsqueda de empleados

  1. Nueva función
    - buscar_empleado_por_nombre: Búsqueda flexible por nombre completo, nombre o apellidos
    - Soporta búsquedas parciales (ej: "Ale" encuentra "Alejandra")
    - Case-insensitive

  2. Retorna
    - Todos los datos de contacto del empleado
*/

CREATE OR REPLACE FUNCTION buscar_empleado_por_nombre(p_busqueda text)
RETURNS TABLE (
  id uuid,
  nombre_completo text,
  nombre text,
  apellidos text,
  rol text,
  puesto text,
  oficina text,
  celular_laboral text,
  celular_personal text,
  extension_telefonica text,
  email_laboral text,
  email_personal text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre || ' ' || u.apellidos as nombre_completo,
    u.nombre,
    u.apellidos,
    u.rol,
    u.puesto,
    o.nombre as oficina,
    u.celular_laboral,
    u.celular_personal,
    u.extension_telefonica,
    u.email_laboral,
    u.email_personal
  FROM usuarios u
  LEFT JOIN oficinas o ON u.oficina_id = o.id
  WHERE u.activo = true
    AND (
      -- Búsqueda en nombre completo
      (u.nombre || ' ' || u.apellidos) ILIKE '%' || p_busqueda || '%'
      -- O búsqueda por palabras individuales
      OR u.nombre ILIKE '%' || p_busqueda || '%'
      OR u.apellidos ILIKE '%' || p_busqueda || '%'
      -- O búsqueda por partes del nombre
      OR EXISTS (
        SELECT 1
        FROM unnest(string_to_array(lower(p_busqueda), ' ')) AS palabra
        WHERE lower(u.nombre) LIKE '%' || palabra || '%'
          OR lower(u.apellidos) LIKE '%' || palabra || '%'
      )
    )
  ORDER BY 
    -- Ordenar por mejor coincidencia
    CASE 
      WHEN lower(u.nombre || ' ' || u.apellidos) = lower(p_busqueda) THEN 1
      WHEN lower(u.nombre || ' ' || u.apellidos) LIKE lower(p_busqueda) || '%' THEN 2
      WHEN lower(u.nombre) LIKE lower(p_busqueda) || '%' THEN 3
      ELSE 4
    END,
    u.nombre, 
    u.apellidos;
END;
$$;

COMMENT ON FUNCTION buscar_empleado_por_nombre IS 'Busca empleados por nombre, apellidos o nombre completo con coincidencia parcial';
