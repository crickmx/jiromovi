/*
  # Actualizar políticas RLS para gestión de catálogos de Registro de Actividades

  1. Cambios
    - Permitir a administradores crear, editar y eliminar tipos de trámite
    - Permitir a administradores crear, editar y eliminar tipos de seguro
    - Todos los usuarios autenticados pueden ver catálogos activos
    
  2. Seguridad
    - Solo administradores pueden modificar catálogos
    - Usuarios regulares solo lectura de catálogos activos
*/

-- =====================================================
-- ACTUALIZAR POLÍTICAS: tramite_activity_types
-- =====================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Todos pueden ver activity types activos" ON tramite_activity_types;
DROP POLICY IF EXISTS "Admin puede gestionar activity types" ON tramite_activity_types;

-- Política de lectura: Todos ven tipos activos
CREATE POLICY "Usuarios pueden ver activity types activos"
  ON tramite_activity_types FOR SELECT
  TO authenticated
  USING (activo = true);

-- Política de lectura para admins: Ven todos (activos e inactivos)
CREATE POLICY "Admin puede ver todos los activity types"
  ON tramite_activity_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Política de inserción: Solo admins
CREATE POLICY "Admin puede crear activity types"
  ON tramite_activity_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Política de actualización: Solo admins
CREATE POLICY "Admin puede actualizar activity types"
  ON tramite_activity_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Política de eliminación: Solo admins
CREATE POLICY "Admin puede eliminar activity types"
  ON tramite_activity_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- =====================================================
-- ACTUALIZAR POLÍTICAS: insurance_types
-- =====================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Todos pueden ver insurance types activos" ON insurance_types;
DROP POLICY IF EXISTS "Admin puede gestionar insurance types" ON insurance_types;

-- Política de lectura: Todos ven tipos activos
CREATE POLICY "Usuarios pueden ver insurance types activos"
  ON insurance_types FOR SELECT
  TO authenticated
  USING (activo = true);

-- Política de lectura para admins: Ven todos (activos e inactivos)
CREATE POLICY "Admin puede ver todos los insurance types"
  ON insurance_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Política de inserción: Solo admins
CREATE POLICY "Admin puede crear insurance types"
  ON insurance_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Política de actualización: Solo admins
CREATE POLICY "Admin puede actualizar insurance types"
  ON insurance_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Política de eliminación: Solo admins
CREATE POLICY "Admin puede eliminar insurance types"
  ON insurance_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );
