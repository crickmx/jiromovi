/*
  # Simplificar política RLS de usuarios para evitar errores de GROUP BY
  
  La política "Authenticated: read active users" tenía un EXISTS subquery que causa
  problemas cuando se hace JOIN desde otras tablas como ticket_archivos.
  
  Simplificamos la política para solo verificar estado activo y no eliminado.
*/

-- Eliminar la política problemática
DROP POLICY IF EXISTS "Authenticated: read active users" ON usuarios;

-- Crear una política simplificada sin subqueries
CREATE POLICY "Authenticated: read active users"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    estado = 'activo'
    AND (is_deleted = false OR is_deleted IS NULL)
  );
