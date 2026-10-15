/*
  # Fix Catálogos Web RLS Policies

  1. Problema
    - Las políticas RLS buscan rol 'administrador' en user_roles
    - Los usuarios tienen rol 'admin' en la tabla usuarios
    - Esto impide que los admins puedan insertar, actualizar o eliminar

  2. Solución
    - Reemplazar todas las políticas para usar la tabla usuarios
    - Usar el rol 'admin' consistentemente
    - Simplificar las políticas para evitar confusión

  3. Cambios
    - DROP políticas antiguas que usan user_roles
    - CREATE políticas nuevas que usan usuarios.rol = 'admin'
*/

-- ========================================
-- WEB_PAGE_INSURERS
-- ========================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Only admins can insert insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Only admins can update insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Only admins can delete insurers" ON web_page_insurers;

-- Crear nuevas políticas usando usuarios.rol
CREATE POLICY "Admins can insert insurers"
  ON web_page_insurers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can update insurers"
  ON web_page_insurers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can delete insurers"
  ON web_page_insurers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- ========================================
-- WEB_PAGE_CATEGORIES
-- ========================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Admins can insert categories" ON web_page_categories;
DROP POLICY IF EXISTS "Admins can update categories" ON web_page_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON web_page_categories;

-- Crear nuevas políticas usando usuarios.rol
CREATE POLICY "Admins can insert categories"
  ON web_page_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can update categories"
  ON web_page_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can delete categories"
  ON web_page_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );
