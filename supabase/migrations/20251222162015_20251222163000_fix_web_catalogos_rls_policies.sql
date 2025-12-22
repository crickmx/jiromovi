/*
  # Fix RLS Policies for Web Catalogues

  1. Changes
    - Drop existing restrictive policies on web_page_insurers and web_page_categories
    - Create new policies that allow admins full access to manage catalogues
    - Ensure authenticated users can view all (active and inactive) for admin panel
    - Keep public access for active items only

  2. Security
    - Admins can manage all records (INSERT, UPDATE, DELETE)
    - Authenticated users can view all records (for admin panel dropdown)
    - Public can only view active records
*/

-- Fix web_page_insurers policies
DROP POLICY IF EXISTS "Admins can manage insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Everyone can view active insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Public can view active insurers" ON web_page_insurers;

-- Allow admins to manage insurers
CREATE POLICY "Admins can insert insurers"
  ON web_page_insurers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );

CREATE POLICY "Admins can update insurers"
  ON web_page_insurers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );

CREATE POLICY "Admins can delete insurers"
  ON web_page_insurers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );

-- Allow authenticated users to view all insurers (for admin panel)
CREATE POLICY "Authenticated can view all insurers"
  ON web_page_insurers
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow public to view active insurers only
CREATE POLICY "Public can view active insurers"
  ON web_page_insurers
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Fix web_page_categories policies
DROP POLICY IF EXISTS "Admins can manage categories" ON web_page_categories;
DROP POLICY IF EXISTS "Everyone can view active categories" ON web_page_categories;
DROP POLICY IF EXISTS "Public can view active categories" ON web_page_categories;

-- Allow admins to manage categories
CREATE POLICY "Admins can insert categories"
  ON web_page_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );

CREATE POLICY "Admins can update categories"
  ON web_page_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );

CREATE POLICY "Admins can delete categories"
  ON web_page_categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.activo = true
      AND usuarios.is_deleted = false
    )
  );

-- Allow authenticated users to view all categories (for admin panel)
CREATE POLICY "Authenticated can view all categories"
  ON web_page_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow public to view active categories only
CREATE POLICY "Public can view active categories"
  ON web_page_categories
  FOR SELECT
  TO anon
  USING (is_active = true);