/*
  # Fix web-page-assets Storage Policies for Gerentes

  1. Descripción
    - Permitir que tanto admins como gerentes puedan gestionar archivos en web-page-assets
    - Esto es necesario para que los gerentes puedan crear y editar aseguradoras en Catálogos Web
    
  2. Cambios
    - Actualizar políticas INSERT, UPDATE y DELETE para incluir gerentes
    - Mantener lectura pública para todos
*/

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Admins can upload web page assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update web page assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete web page assets" ON storage.objects;

-- Política para INSERT (admins y gerentes)
CREATE POLICY "Admins and gerentes can upload web page assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'web-page-assets'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

-- Política para UPDATE (admins y gerentes)
CREATE POLICY "Admins and gerentes can update web page assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'web-page-assets'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

-- Política para DELETE (admins y gerentes)
CREATE POLICY "Admins and gerentes can delete web page assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'web-page-assets'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );
