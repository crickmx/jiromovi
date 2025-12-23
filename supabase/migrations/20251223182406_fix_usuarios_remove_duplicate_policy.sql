/*
  # Eliminar política duplicada de usuarios

  1. Problema
    - Existe "Authenticated users can view active users" (estado <> 'eliminado')
    - También existe "Users can view active users" (estado = 'activo')
    - Esto causa conflicto en las consultas

  2. Solución
    - Eliminar la política conflictiva
    - Mantener solo la política clara y específica

  3. Resultado
    - Una sola política para ver usuarios activos
    - Menos confusión y mejor rendimiento
*/

-- Eliminar política duplicada/conflictiva
DROP POLICY IF EXISTS "Authenticated users can view active users" ON usuarios;

-- Comentario
COMMENT ON POLICY "Users can view active users" ON usuarios IS 
  'Permite que usuarios autenticados vean otros usuarios activos (no eliminados). Necesario para directorios, listas de usuarios, mensajes, asignaciones, y para que políticas de otras tablas puedan hacer JOIN con usuarios.';
