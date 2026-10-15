/*
  # Corregir funciones de Registro de Actividades

  1. Problemas identificados
    - Columna `fecha_eliminacion` no existe (debe ser `deleted_at`)
    - Estado debe ser 'activo' (minúsculas)
    - Ambigüedad en columna `id` en get_office_users_for_requester

  2. Solución
    - Corregir nombres de columnas
    - Usar aliases apropiados para evitar ambigüedad
    - Usar valores correctos para estado
*/

-- =====================================================
-- 1. FIX: get_users_who_can_attend
-- =====================================================
DROP FUNCTION IF EXISTS get_users_who_can_attend();

CREATE FUNCTION get_users_who_can_attend()
RETURNS TABLE (
  id uuid,
  nombre_completo text,
  rol text,
  oficina_nombre text
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
BEGIN
  -- Obtener oficina del usuario actual
  SELECT usuarios.oficina_id INTO v_oficina_id
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
    AND u.estado = 'activo'
    AND u.deleted_at IS NULL
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
'Retorna usuarios de la misma oficina que pueden atender trámites (Empleado, Gerente, Administrador)';

-- =====================================================
-- 2. FIX: get_office_users_for_requester
-- =====================================================
DROP FUNCTION IF EXISTS get_office_users_for_requester();

CREATE FUNCTION get_office_users_for_requester()
RETURNS TABLE (
  id uuid,
  nombre_completo text,
  rol text,
  oficina_id uuid,
  oficina_nombre text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_rol text;
  v_user_oficina_id uuid;
BEGIN
  -- Obtener rol y oficina del usuario actual
  SELECT usuarios.rol, usuarios.oficina_id 
  INTO v_user_rol, v_user_oficina_id
  FROM usuarios
  WHERE usuarios.id = auth.uid();

  -- Retornar usuarios según permisos
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre_completo,
    u.rol,
    u.oficina_id,
    o.nombre as oficina_nombre
  FROM usuarios u
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE u.estado = 'activo'
    AND u.deleted_at IS NULL
    AND (
      -- Admin ve todos
      v_user_rol = 'Administrador'
      OR
      -- Gerente ve usuarios de su oficina
      (v_user_rol = 'Gerente' AND u.oficina_id = v_user_oficina_id)
      OR
      -- Empleado ve usuarios de su oficina
      (v_user_rol = 'Empleado' AND u.oficina_id = v_user_oficina_id)
    )
  ORDER BY u.nombre_completo;
END;
$$;

COMMENT ON FUNCTION get_office_users_for_requester IS 
'Retorna usuarios que pueden ser solicitantes según el rol del usuario actual';
