/*
  # Add Delete Policy for Publicidad Diseños
  
  1. Changes
    - Add DELETE policy so users can delete their own designs
    
  2. Security
    - Users can only delete their own designs
    - RLS ensures data isolation
*/

CREATE POLICY "Usuarios pueden eliminar sus propios diseños"
  ON publicidad_disenos
  FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());
