/*
  # Consolidar políticas RLS de usuarios para permitir JOINs

  1. Problema
    - Múltiples políticas duplicadas en usuarios (read own, view own data, self lookup)
    - Las políticas de otras tablas (comunicados) fallan al hacer JOIN con usuarios
    - Error "Acceso Denegado" al intentar ver comunicados

  2. Solución
    - Eliminar políticas duplicadas
    - Crear una política consolidada y clara
    - Permitir que JOINs desde otras tablas accedan a info básica del usuario actual

  3. Políticas consolidadas
    - Administradores ven todos
    - Usuarios ven su propia información (necesario para JOINs de otras políticas)
    - Usuarios ven otros usuarios activos (para directorio)
    - Gerentes ven usuarios de su oficina
*/

-- =====================================================
-- ELIMINAR POLÍTICAS DUPLICADAS Y CONFLICTIVAS
-- =====================================================

DROP POLICY IF EXISTS "Users can read own profile" ON usuarios;
DROP POLICY IF EXISTS "Users can view own data" ON usuarios;
DROP POLICY IF EXISTS "Allow users self lookup for RLS" ON usuarios;
DROP POLICY IF EXISTS "Authenticated users can view all active users" ON usuarios;
DROP POLICY IF EXISTS "Users can view active users for directory" ON usuarios;

-- =====================================================
-- POLÍTICAS CONSOLIDADAS Y OPTIMIZADAS
-- =====================================================

-- 1. Administradores ven todo (sin cambios)
-- Ya existe: "Admins view all users"

-- 2. Usuarios pueden ver su propia información
-- CRÍTICO: Necesario para que políticas de otras tablas puedan hacer JOIN
CREATE POLICY "Users can view own profile"
  ON usuarios FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- 3. Usuarios pueden ver otros usuarios activos (para directorios, mensajes, etc)
CREATE POLICY "Users can view active users"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    estado = 'activo' 
    AND (is_deleted = false OR is_deleted IS NULL)
  );

-- 4. Gerentes ven usuarios de su oficina (ya existe, no tocar)
-- Ya existe: "Gerentes can view own office users"

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON POLICY "Users can view own profile" ON usuarios IS 
  'Permite que un usuario vea su propia información. CRÍTICO para que políticas de otras tablas (como comunicados) puedan hacer JOIN con usuarios para verificar permisos del usuario actual.';

COMMENT ON POLICY "Users can view active users" ON usuarios IS 
  'Permite que usuarios vean otros usuarios activos. Necesario para directorios, listas de usuarios, mensajes, etc.';
