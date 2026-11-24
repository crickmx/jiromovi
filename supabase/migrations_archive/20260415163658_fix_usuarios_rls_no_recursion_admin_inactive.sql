/*
  # Fix RLS usuarios: eliminar recursión infinita

  ## Problema
  Las políticas que hacen subquery a `usuarios` para verificar el rol del usuario
  actual causan recursión infinita (42P17).

  ## Solución
  Usar `auth.jwt()` para leer el rol desde el JWT token en lugar de hacer
  subquery a la tabla `usuarios`. Esto rompe el ciclo de recursión.

  También se usa una función helper con SECURITY DEFINER que accede a la tabla
  mediante un bypass de RLS para verificar el rol del usuario actual.
*/

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Admins can read all non-deleted users" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users read active users" ON usuarios;

-- Función helper que lee el rol del usuario actual sin disparar RLS
CREATE OR REPLACE FUNCTION get_current_user_rol()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT rol FROM usuarios
  WHERE id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;
$$;

-- Política para Administradores: ven todos los usuarios no eliminados (incluye inactivos)
-- Usa la función helper para evitar recursión
CREATE POLICY "Admins can read all non-deleted users"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN get_current_user_rol() = 'Administrador' THEN
        (is_deleted = false OR is_deleted IS NULL)
      ELSE
        (estado = 'activo' AND (is_deleted = false OR is_deleted IS NULL))
    END
  );
