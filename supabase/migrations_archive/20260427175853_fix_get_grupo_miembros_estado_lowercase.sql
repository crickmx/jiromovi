/*
  # Fix get_grupo_miembros function - case mismatch on estado

  1. Changes
    - Fix `estado = 'Activo'` to `estado = 'activo'` to match actual DB values
    - Use existing `nombre_completo` column instead of building from nombre + apellidos

  2. Reason
    - Members were not displaying because the function filtered by uppercase 'Activo'
      but the database stores 'activo' in lowercase
*/

DROP FUNCTION IF EXISTS get_grupo_miembros(uuid);

CREATE OR REPLACE FUNCTION public.get_grupo_miembros(p_grupo_id uuid)
RETURNS TABLE(id uuid, nombre_completo text, oficina_nombre text, rol text, oficina_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.nombre_completo, UPPER(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellidos, ''))) as nombre_completo,
    o.nombre as oficina_nombre,
    u.rol,
    u.oficina_id
  FROM usuarios u
  INNER JOIN tramites_grupos_miembros m ON m.usuario_id = u.id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE m.grupo_id = p_grupo_id
    AND u.estado = 'activo'
  ORDER BY nombre_completo;
END;
$function$;
