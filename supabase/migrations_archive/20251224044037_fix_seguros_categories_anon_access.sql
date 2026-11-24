/*
  # Permitir acceso anónimo a categorías de educación
  
  1. Cambios
    - Agregar política para que usuarios anónimos puedan leer categorías activas
    - Esto permite que el script de migración funcione sin autenticación
  
  2. Seguridad
    - Solo lectura (SELECT)
    - Solo categorías activas
    - No permite modificaciones
*/

-- Eliminar la política si existe y recrearla
DROP POLICY IF EXISTS "Anonymous users can view active categories" ON seguros_categories;

-- Permitir a usuarios anónimos ver categorías activas
CREATE POLICY "Anonymous users can view active categories"
  ON seguros_categories
  FOR SELECT
  TO anon
  USING (activa = true);

-- También permitir a usuarios anónimos ver lecciones activas
DROP POLICY IF EXISTS "Anonymous users can view active lessons" ON seguros_lessons;

CREATE POLICY "Anonymous users can view active lessons"
  ON seguros_lessons
  FOR SELECT
  TO anon
  USING (true);
