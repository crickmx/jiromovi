/*
  # Actualizar visibilidad para Directorio JIRO
  
  ## Descripción
  Permite que Administradores, Gerentes, Empleados y Agentes puedan ver
  usuarios con rol Empleado y Gerente en el Directorio JIRO.
  
  ## Cambios
  1. Actualizar política "Gerentes view own office users only"
     - Permitir ver Empleados y Gerentes de cualquier oficina
  
  2. Actualizar política "Employees and agents view users"
     - Permitir ver Empleados y Gerentes de cualquier oficina
  
  ## Reglas de Visibilidad
  - Administradores: Ven todos los usuarios (sin cambios)
  - Gerentes: Ven todos los Empleados y Gerentes
  - Empleados: Ven todos los Empleados y Gerentes
  - Agentes: Ven todos los Empleados y Gerentes
  
  ## Seguridad
  - No se expone información sensible (solo datos de directorio)
  - Se mantiene RLS activo
  - Usuarios pueden seguir viendo su propio perfil
*/

-- =====================================================
-- 1. Actualizar política para Gerentes
-- =====================================================

DROP POLICY IF EXISTS "Gerentes view own office users only" ON usuarios;

CREATE POLICY "Gerentes view employees and gerentes"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'Gerente'
    AND rol IN ('Empleado', 'Gerente')
  );

-- =====================================================
-- 2. Actualizar política para Empleados y Agentes
-- =====================================================

DROP POLICY IF EXISTS "Employees and agents view users" ON usuarios;

CREATE POLICY "Employees and agents view employees and gerentes"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() IN ('Empleado', 'Agente')
    AND rol IN ('Empleado', 'Gerente')
  );

-- =====================================================
-- Logs
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Políticas de visibilidad actualizadas para Directorio JIRO';
  RAISE NOTICE '✅ Gerentes pueden ver: Empleados + Gerentes (todas las oficinas)';
  RAISE NOTICE '✅ Empleados pueden ver: Empleados + Gerentes (todas las oficinas)';
  RAISE NOTICE '✅ Agentes pueden ver: Empleados + Gerentes (todas las oficinas)';
  RAISE NOTICE '✅ Administradores pueden ver: Todos (sin cambios)';
END $$;
