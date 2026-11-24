/*
  # Corregir Políticas RLS de web_page_insurers

  ## Descripción
  Corrige las políticas RLS de web_page_insurers para que sean consistentes
  y permitan a todos los usuarios autenticados ver las aseguradoras.

  ## Cambios
  1. Elimina todas las políticas conflictivas existentes
  2. Crea políticas consistentes y simples
  3. Permite a usuarios autenticados ver todas las aseguradoras
  4. Solo administradores pueden modificar

  ## Seguridad
  - SELECT: Todos los usuarios autenticados pueden ver
  - INSERT/UPDATE/DELETE: Solo administradores
*/

-- Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Admins can view all insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Non-admins can view active insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Authenticated can view all insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Admins can insert insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Admins can update insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Admins can delete insurers" ON web_page_insurers;
DROP POLICY IF EXISTS "Public can view active insurers" ON web_page_insurers;

-- Política simple para SELECT: todos los autenticados pueden ver
CREATE POLICY "Authenticated users can view all insurers"
  ON web_page_insurers
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para anónimos: solo ven las activas (para páginas públicas)
CREATE POLICY "Public can view active insurers"
  ON web_page_insurers
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Solo admins pueden insertar
CREATE POLICY "Only admins can insert insurers"
  ON web_page_insurers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE usuario_id = auth.uid()
      AND rol = 'administrador'
    )
  );

-- Solo admins pueden actualizar
CREATE POLICY "Only admins can update insurers"
  ON web_page_insurers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE usuario_id = auth.uid()
      AND rol = 'administrador'
    )
  );

-- Solo admins pueden eliminar
CREATE POLICY "Only admins can delete insurers"
  ON web_page_insurers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE usuario_id = auth.uid()
      AND rol = 'administrador'
    )
  );