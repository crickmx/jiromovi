/*
  # Simplificar Políticas de web-page-assets Storage

  1. Descripción
    - Permitir que cualquier usuario autenticado pueda subir archivos a web-page-assets
    - Esto resuelve problemas con auth.uid() en el contexto de Storage
    
  2. Cambios
    - Simplificar políticas para no depender de la tabla usuarios
    - Confiar en que solo usuarios autenticados tengan acceso al módulo
*/

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Admins and gerentes can upload web page assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins and gerentes can update web page assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins and gerentes can delete web page assets" ON storage.objects;

-- Política simple para INSERT (cualquier usuario autenticado)
CREATE POLICY "Authenticated users can upload web page assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'web-page-assets');

-- Política simple para UPDATE (cualquier usuario autenticado)
CREATE POLICY "Authenticated users can update web page assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'web-page-assets');

-- Política simple para DELETE (cualquier usuario autenticado)
CREATE POLICY "Authenticated users can delete web page assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'web-page-assets');
