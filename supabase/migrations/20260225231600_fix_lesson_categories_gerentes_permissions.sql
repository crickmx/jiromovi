/*
  # Fix Lesson Categories Permissions for Gerentes

  ## Problem
  - Gerentes with "seguros_education" permissions cannot assign categories to lessons
  - RLS policies on seguros_lesson_categories only allow 'Administrador' role
  - The assign_lesson_categories function works but policies block the INSERT/DELETE

  ## Solution
  - Update RLS policies to include Gerentes with additional permissions
  - Use tiene_permiso_admin_en_modulo() for authorization

  ## Tables Affected
  - seguros_lesson_categories
*/

-- =====================================================
-- DROP OLD RESTRICTIVE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert lesson categories" ON seguros_lesson_categories;
DROP POLICY IF EXISTS "Admins can delete lesson categories" ON seguros_lesson_categories;

-- =====================================================
-- CREATE NEW INCLUSIVE POLICIES
-- =====================================================

-- Allow INSERT for Admins and Gerentes with seguros_education permission
CREATE POLICY "Admins and authorized gerentes can insert lesson categories"
  ON seguros_lesson_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Global Administrator
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    -- Gerente with seguros_education permission
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  );

-- Allow DELETE for Admins and Gerentes with seguros_education permission
CREATE POLICY "Admins and authorized gerentes can delete lesson categories"
  ON seguros_lesson_categories FOR DELETE
  TO authenticated
  USING (
    -- Global Administrator
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    -- Gerente with seguros_education permission
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "Admins and authorized gerentes can insert lesson categories" ON seguros_lesson_categories IS
  'Allows Administrators and Gerentes with "seguros_education" permission to assign categories to lessons';

COMMENT ON POLICY "Admins and authorized gerentes can delete lesson categories" ON seguros_lesson_categories IS
  'Allows Administrators and Gerentes with "seguros_education" permission to remove category assignments from lessons';

-- =====================================================
-- VERIFICATION LOG
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed seguros_lesson_categories RLS policies';
  RAISE NOTICE '   - Gerentes with seguros_education permission can now assign categories';
  RAISE NOTICE '   - Both INSERT and DELETE operations allowed';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Affected function: assign_lesson_categories()';
  RAISE NOTICE '   - Function is SECURITY DEFINER and will now work for authorized gerentes';
END $$;
