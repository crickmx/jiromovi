/*
  # Restrict Publicidad Storage to Admins Only

  1. Changes
    - Drop existing storage policies for publicidad-plantillas
    - Only Administradores can upload, update, and delete plantilla files
    - All users can view plantilla files (public read)

  2. Security
    - Only Admins can manage plantilla files
    - All users can view plantilla files to use them in their designs
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and Gerentes can upload plantillas" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Gerentes can update plantillas" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Gerentes can delete plantillas" ON storage.objects;
DROP POLICY IF EXISTS "All users can view plantillas" ON storage.objects;

-- Create new policies for uploading plantillas - ADMIN ONLY
CREATE POLICY "Only admins can upload plantillas"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'publicidad-plantillas' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Create policy for updating plantillas - ADMIN ONLY
CREATE POLICY "Only admins can update plantillas"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'publicidad-plantillas' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Create policy for deleting plantillas - ADMIN ONLY
CREATE POLICY "Only admins can delete plantillas"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'publicidad-plantillas' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Create policy for viewing plantillas (public read for all authenticated users)
CREATE POLICY "All users can view plantillas files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'publicidad-plantillas');