/*
  # Fix Catálogos Web - RLS Policies para Admin

  ## Descripción
  Los admins necesitan ver TODAS las aseguradoras y ramos (activos e inactivos)
  para poder gestionarlos correctamente.

  ## Cambios
  1. Agregar política para que admins puedan ver todas las aseguradoras
  2. Agregar política para que admins puedan ver todos los ramos
*/

-- Drop políticas conflictivas y recrear correctamente
DROP POLICY IF EXISTS "Everyone can view active insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Everyone can view active categories" ON web_page_categories;

-- Admins pueden ver TODAS las aseguradoras (activas e inactivas)
CREATE POLICY "Admins can view all insurers"
  ON web_page_insurers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Usuarios no-admin solo pueden ver activas
CREATE POLICY "Non-admins can view active insurers"
  ON web_page_insurers
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Admins pueden ver TODOS los ramos (activos e inactivos)
CREATE POLICY "Admins can view all categories"
  ON web_page_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Usuarios no-admin solo pueden ver activos
CREATE POLICY "Non-admins can view active categories"
  ON web_page_categories
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );