/*
  # Limpiar Políticas Duplicadas
  
  Eliminar políticas antiguas que quedaron después de las migraciones
*/

-- Eliminar políticas antiguas de ticket_asignaciones
DROP POLICY IF EXISTS "Ejecutivos y superiores pueden crear asignaciones" ON ticket_asignaciones;
DROP POLICY IF EXISTS "Ejecutivos y superiores pueden eliminar asignaciones" ON ticket_asignaciones;
DROP POLICY IF EXISTS "Usuarios pueden ver asignaciones de sus tickets" ON ticket_asignaciones;

-- Eliminar políticas antiguas de ticket_comentarios
DROP POLICY IF EXISTS "Usuarios pueden crear comentarios en sus tickets" ON ticket_comentarios;
DROP POLICY IF EXISTS "Usuarios pueden ver comentarios de sus tickets" ON ticket_comentarios;

-- Eliminar políticas antiguas de ticket_historial
DROP POLICY IF EXISTS "Sistema puede crear historial" ON ticket_historial;
DROP POLICY IF EXISTS "Usuarios pueden ver historial de sus tickets" ON ticket_historial;

-- Eliminar políticas antiguas de ticket_archivos
DROP POLICY IF EXISTS "Usuarios pueden subir archivos a sus tickets" ON ticket_archivos;
DROP POLICY IF EXISTS "Usuarios pueden ver archivos de sus tickets" ON ticket_archivos;
