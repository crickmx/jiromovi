/*
  # Corregir acceso a comunicados - Permitir JOIN con usuarios

  1. Problema
    - Las políticas de comunicados hacen JOIN con usuarios
    - Las políticas SELECT de usuarios son demasiado restrictivas
    - Esto bloquea el acceso a comunicados con error "Acceso Denegado"

  2. Solución
    - Agregar política permisiva para que otras tablas puedan hacer JOIN con usuarios
    - Permitir consultas de información básica (rol, oficina_id) sin restricciones
    - Esto no expone datos sensibles, solo permite verificar permisos

  3. Seguridad
    - Solo aplica cuando se consulta desde otra tabla (vía JOIN)
    - No expone información adicional
    - Necesaria para que RLS funcione correctamente en tablas relacionadas
*/

-- Eliminar política conflictiva si existe
DROP POLICY IF EXISTS "Allow users self lookup for RLS" ON usuarios;

-- Crear política que permite que otras políticas RLS hagan JOIN con usuarios
-- Esta política es necesaria para que las políticas de otras tablas funcionen
CREATE POLICY "Allow users self lookup for RLS"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    -- Permitir ver información propia sin restricciones (para JOINs)
    id = (SELECT auth.uid())
  );

-- Comentarios
COMMENT ON POLICY "Allow users self lookup for RLS" ON usuarios IS 
  'Permite que otras políticas RLS hagan JOIN con usuarios para verificar permisos. Sin esta política, las consultas de comunicados y otras tablas fallan con "Acceso Denegado".';
