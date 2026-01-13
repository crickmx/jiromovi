/*
  # Fix Publicidad Storage Policies - Allow Gerentes

  1. Changes
    - Drop existing storage policies for publicidad-plantillas
    - Create new policies that check usuarios table
    - Allow both Administrador and Gerente to upload/manage plantillas

  2. Security
    - Admins and Gerentes can upload, update, and delete plantilla files
    - All users can view plantilla files (public read)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin puede subir plantillas" ON storage.objects;
DROP POLICY IF EXISTS "Admin puede actualizar plantillas" ON storage.objects;
DROP POLICY IF EXISTS "Admin puede eliminar plantillas" ON storage.objects;
DROP POLICY IF EXISTS "Public can view publicidad plantillas" ON storage.objects;
DROP POLICY IF EXISTS "Todos pueden ver plantillas" ON storage.objects;

-- Create new policies for uploading plantillas
CREATE POLICY "Admins and Gerentes can upload plantillas"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'publicidad-plantillas' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Create policy for updating plantillas
CREATE POLICY "Admins and Gerentes can update plantillas"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'publicidad-plantillas' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Create policy for deleting plantillas
CREATE POLICY "Admins and Gerentes can delete plantillas"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'publicidad-plantillas' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- Create policy for viewing plantillas (public read)
CREATE POLICY "All users can view plantillas"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'publicidad-plantillas');