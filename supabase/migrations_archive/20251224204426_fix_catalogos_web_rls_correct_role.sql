/*
  # Fix Catálogos Web RLS - Usar rol correcto

  1. Problema
    - Las políticas RLS buscan usuarios.rol = 'admin'
    - El rol real en la base de datos es 'Administrador'
    - Por eso ningún usuario puede insertar, actualizar o eliminar

  2. Solución
    - Actualizar todas las políticas para usar 'Administrador'
    
  3. Cambios
    - DROP y CREATE políticas con el rol correcto
*/

-- ========================================
-- WEB_PAGE_INSURERS
-- ========================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Admins can insert insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Admins can update insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Admins can delete insurers" ON web_page_insurers;

-- Crear nuevas políticas con el rol correcto
CREATE POLICY "Administradores can insert insurers"
  ON web_page_insurers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administradores can update insurers"
  ON web_page_insurers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administradores can delete insurers"
  ON web_page_insurers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- ========================================
-- WEB_PAGE_CATEGORIES
-- ========================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Admins can insert categories" ON web_page_categories;
DROP POLICY IF EXISTS "Admins can update categories" ON web_page_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON web_page_categories;

-- Crear nuevas políticas con el rol correcto
CREATE POLICY "Administradores can insert categories"
  ON web_page_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administradores can update categories"
  ON web_page_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Administradores can delete categories"
  ON web_page_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );
