/*
  # Fix Storage Policies for web-page-assets Bucket
  
  1. Descripción
    - Permitir que admins suban archivos al bucket web-page-assets
    - Mantener el bucket público para lectura
    
  2. Cambios
    - Agregar política para que admins puedan subir archivos
    - Mantener lectura pública
*/

-- Agregar política para que admins puedan insertar archivos
DROP POLICY IF EXISTS "Admins can upload web page assets" ON storage.objects;

CREATE POLICY "Admins can upload web page assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'web-page-assets'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Agregar política para que admins puedan actualizar archivos
DROP POLICY IF EXISTS "Admins can update web page assets" ON storage.objects;

CREATE POLICY "Admins can update web page assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'web-page-assets'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Agregar política para que admins puedan eliminar archivos
DROP POLICY IF EXISTS "Admins can delete web page assets" ON storage.objects;

CREATE POLICY "Admins can delete web page assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'web-page-assets'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );
