/*
  # Fix RLS en tramites_grupos_reglas para INSERT/UPDATE/DELETE

  Las políticas de 000003 usan un subquery a `usuarios` dentro del WITH CHECK,
  pero la RLS de `usuarios` bloquea ese subquery causando el error:
  "new row violates row-level security policy".

  Fix: función SECURITY DEFINER que verifica el rol sin verse afectada por RLS.
*/

-- Helper SECURITY DEFINER: verifica si el usuario actual es Administrador
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
    AND rol = 'Administrador'
  );
$$;

-- Recrear políticas usando el helper (evita recursión RLS)
DROP POLICY IF EXISTS "Admins can insert tramites_grupos_reglas"  ON tramites_grupos_reglas;
DROP POLICY IF EXISTS "Admins can update tramites_grupos_reglas"  ON tramites_grupos_reglas;
DROP POLICY IF EXISTS "Admins can delete tramites_grupos_reglas"  ON tramites_grupos_reglas;
DROP POLICY IF EXISTS "Admins can select tramites_grupos_reglas"  ON tramites_grupos_reglas;

CREATE POLICY "Admins can select tramites_grupos_reglas"
  ON tramites_grupos_reglas FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());

CREATE POLICY "Admins can insert tramites_grupos_reglas"
  ON tramites_grupos_reglas FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Admins can update tramites_grupos_reglas"
  ON tramites_grupos_reglas FOR UPDATE
  TO authenticated
  USING  (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Admins can delete tramites_grupos_reglas"
  ON tramites_grupos_reglas FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());
