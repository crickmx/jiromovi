/*
  # Fix ticket_archivos RLS - error de GROUP BY
  
  El error de GROUP BY en ticket_archivos.fecha_subida ocurre porque
  la política RLS WITH CHECK usa auth.uid() con una subconsulta.
  Se simplifica la política para evitar este problema.
*/

-- Eliminar política existente
DROP POLICY IF EXISTS "ticket_archivos_insert_all" ON ticket_archivos;

-- Recrear con política más simple
CREATE POLICY "ticket_archivos_insert_all"
  ON ticket_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

COMMENT ON POLICY "ticket_archivos_insert_all" ON ticket_archivos IS
  'Usuarios autenticados pueden insertar archivos propios';
