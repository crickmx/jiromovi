/*
  # Actualizar políticas de storage para permitir Gerentes
  
  ## Descripción
  Actualiza las políticas del bucket "comunicados" para permitir que
  usuarios con rol Gerente puedan subir imágenes y adjuntos para sus
  comunicados.
  
  ## Cambios
  1. Política INSERT: Permitir Administradores y Gerentes
  2. Política UPDATE: Permitir Administradores y Gerentes
  3. Política DELETE: Permitir Administradores (sin cambios)
  4. Política SELECT: Todos pueden ver (sin cambios)
  
  ## Seguridad
  - Gerentes solo pueden subir a bucket "comunicados"
  - RLS verifica rol en tabla usuarios
*/

-- =====================================================
-- 1. Actualizar política INSERT (subir archivos)
-- =====================================================

DROP POLICY IF EXISTS "Admins can upload comunicados files" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Gerentes can upload comunicados files" ON storage.objects;

CREATE POLICY "Admins and Gerentes can upload comunicados files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comunicados'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- =====================================================
-- 2. Actualizar política UPDATE (actualizar archivos)
-- =====================================================

DROP POLICY IF EXISTS "Admins can update comunicados files" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Gerentes can update comunicados files" ON storage.objects;

CREATE POLICY "Admins and Gerentes can update comunicados files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'comunicados'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    bucket_id = 'comunicados'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- =====================================================
-- 3. Política DELETE - Solo Administradores (sin cambio)
-- =====================================================

-- Ya existe, no necesita cambios
-- Los Gerentes pueden eliminar sus comunicados desde la tabla,
-- pero solo Admins pueden eliminar archivos del storage

-- =====================================================
-- Logs
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Políticas de storage actualizadas para comunicados';
  RAISE NOTICE '✅ Gerentes ahora pueden subir imágenes y adjuntos';
  RAISE NOTICE '✅ Política INSERT actualizada';
  RAISE NOTICE '✅ Política UPDATE actualizada';
  RAISE NOTICE '⚠️  Solo Administradores pueden eliminar archivos del storage';
END $$;
