/*
  # Fix Seguros Education Permissions for Gerentes

  ## Problema
  1. Gerentes con permisos adicionales en "seguros_education" no pueden crear categorías
  2. Error: "new row violates row-level security policy for table seguros_categories"
  3. Las políticas RLS solo permiten Administradores, no Gerentes con permisos adicionales
  4. Al editar lecciones, los cambios no se guardan (mismo problema de permisos)

  ## Solución
  - Actualizar políticas RLS para permitir Gerentes con permisos en "seguros_education"
  - Usar la función tiene_permiso_admin_en_modulo() para verificar permisos
  - Aplicar a seguros_categories, seguros_lessons, y seguros_sessions

  ## Tablas Afectadas
  - seguros_categories
  - seguros_lessons
  - seguros_sessions
*/

-- =====================================================
-- 1. ACTUALIZAR POLÍTICAS DE seguros_categories
-- =====================================================

-- Eliminar política antigua que solo permite Administradores
DROP POLICY IF EXISTS "Admins can manage categories" ON seguros_categories;

-- Crear nueva política que permite Admins Y Gerentes con permisos
CREATE POLICY "Admins and authorized gerentes can manage categories"
  ON seguros_categories FOR ALL
  TO authenticated
  USING (
    -- Administrador global
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    -- Gerente con permiso adicional en seguros_education
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  );

-- =====================================================
-- 2. ACTUALIZAR POLÍTICAS DE seguros_lessons
-- =====================================================

-- Eliminar política antigua que solo permite Administradores
DROP POLICY IF EXISTS "Admins can manage lessons" ON seguros_lessons;

-- Crear nueva política que permite Admins Y Gerentes con permisos
CREATE POLICY "Admins and authorized gerentes can manage lessons"
  ON seguros_lessons FOR ALL
  TO authenticated
  USING (
    -- Administrador global
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    -- Gerente con permiso adicional en seguros_education
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  );

-- =====================================================
-- 3. ACTUALIZAR POLÍTICAS DE seguros_sessions
-- =====================================================

-- Eliminar política antigua que solo permite Administradores
DROP POLICY IF EXISTS "Admins can manage sessions" ON seguros_sessions;

-- Crear nueva política que permite Admins Y Gerentes con permisos
CREATE POLICY "Admins and authorized gerentes can manage sessions"
  ON seguros_sessions FOR ALL
  TO authenticated
  USING (
    -- Administrador global
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    -- Gerente con permiso adicional en seguros_education
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  );

-- =====================================================
-- 4. COMENTARIOS
-- =====================================================

COMMENT ON POLICY "Admins and authorized gerentes can manage categories" ON seguros_categories IS
  'Permite a Administradores y Gerentes con permiso "seguros_education" crear, editar y eliminar categorías';

COMMENT ON POLICY "Admins and authorized gerentes can manage lessons" ON seguros_lessons IS
  'Permite a Administradores y Gerentes con permiso "seguros_education" crear, editar y eliminar lecciones';

COMMENT ON POLICY "Admins and authorized gerentes can manage sessions" ON seguros_sessions IS
  'Permite a Administradores y Gerentes con permiso "seguros_education" crear, editar y eliminar sesiones';

-- =====================================================
-- 5. VERIFICACIÓN
-- =====================================================

-- Log de verificación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS actualizadas para seguros_education';
  RAISE NOTICE '   - seguros_categories: Admins + Gerentes con permiso';
  RAISE NOTICE '   - seguros_lessons: Admins + Gerentes con permiso';
  RAISE NOTICE '   - seguros_sessions: Admins + Gerentes con permiso';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Para asignar permiso a un Gerente:';
  RAISE NOTICE '   INSERT INTO permisos_adicionales_gerente (usuario_id, modulo_id)';
  RAISE NOTICE '   SELECT ''[UUID_GERENTE]'', id FROM modulos_sistema WHERE codigo = ''seguros_education'';';
END $$;