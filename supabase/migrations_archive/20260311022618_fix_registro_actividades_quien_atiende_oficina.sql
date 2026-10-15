/*
  # Filtrar usuarios "Quién Atiende" por oficina

  1. Cambios
    - Actualiza la función `get_users_who_can_attend()` para filtrar solo usuarios de la misma oficina
    - Solo muestra Empleados, Gerentes y Administradores de la oficina del usuario actual
    - Ordena por rol (Admin → Gerente → Empleado) y luego alfabéticamente

  2. Seguridad
    - Función con SECURITY DEFINER para acceder a datos de oficina
    - Filtra automáticamente por oficina del usuario autenticado
*/

-- Eliminar función existente
DROP FUNCTION IF EXISTS get_users_who_can_attend();

-- Crear función actualizada que filtra por oficina
CREATE FUNCTION get_users_who_can_attend()
RETURNS TABLE (
  id uuid,
  nombre_completo text,
  rol text,
  oficina_nombre text
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_oficina_id uuid;
BEGIN
  -- Obtener oficina del usuario actual
  SELECT oficina_id INTO v_oficina_id
  FROM usuarios
  WHERE usuarios.id = auth.uid();

  -- Si no tiene oficina, retornar vacío
  IF v_oficina_id IS NULL THEN
    RETURN;
  END IF;

  -- Retornar usuarios de la misma oficina con roles permitidos
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre_completo,
    u.rol,
    o.nombre as oficina_nombre
  FROM usuarios u
  LEFT JOIN oficinas o ON u.oficina_id = o.id
  WHERE u.oficina_id = v_oficina_id
    AND u.rol IN ('Empleado', 'Gerente', 'Administrador')
    AND u.estado = 'Activo'
    AND (u.fecha_eliminacion IS NULL OR u.fecha_eliminacion > now())
  ORDER BY 
    CASE u.rol
      WHEN 'Administrador' THEN 1
      WHEN 'Gerente' THEN 2
      WHEN 'Empleado' THEN 3
      ELSE 4
    END,
    u.nombre_completo;
END;
$$;

COMMENT ON FUNCTION get_users_who_can_attend IS 
'Retorna usuarios de la misma oficina que pueden atender trámites (Empleado, Gerente, Administrador). Autoselecciona al usuario actual.';
