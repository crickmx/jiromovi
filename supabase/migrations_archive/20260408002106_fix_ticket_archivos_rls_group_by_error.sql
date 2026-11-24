/*
  # Arreglar error de GROUP BY en ticket_archivos
  
  El problema ocurre cuando se hace un JOIN con usuarios y las políticas RLS 
  causan conflictos con agregaciones. Necesitamos políticas más específicas.
*/

-- Eliminar políticas existentes que causan problemas
DROP POLICY IF EXISTS "ticket_archivos_select_all" ON ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_insert_all" ON ticket_archivos;

-- Crear políticas más específicas sin subqueries problemáticas
CREATE POLICY "Users can view all ticket files"
  ON ticket_archivos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own files"
  ON ticket_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can delete own files"
  ON ticket_archivos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can update own files"
  ON ticket_archivos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);
