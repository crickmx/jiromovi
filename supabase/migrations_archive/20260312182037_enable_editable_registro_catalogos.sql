/*
  # Habilitar gestión de catálogos de Registro de Actividades

  1. Permisos de modificación
    - Permitir a Admin y Gerente gestionar catálogos de tipos de trámite
    - Permitir a Admin y Gerente gestionar catálogos de tipos de seguro
    - Mantener seguridad: no borrar datos con relaciones activas

  2. Funciones de gestión
    - Crear/Editar/Eliminar (soft delete) tipos de trámite
    - Crear/Editar/Eliminar (soft delete) tipos de seguro
*/

-- =====================================================
-- PERMISOS: TRAMITE ACTIVITY TYPES
-- =====================================================

-- Eliminar políticas anteriores restrictivas y agregar nuevas
DROP POLICY IF EXISTS "Admin puede gestionar activity types" ON tramite_activity_types;

CREATE POLICY "Admin y Gerente pueden insertar activity types"
  ON tramite_activity_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admin y Gerente pueden actualizar activity types"
  ON tramite_activity_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admin y Gerente pueden eliminar activity types"
  ON tramite_activity_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- =====================================================
-- PERMISOS: INSURANCE TYPES
-- =====================================================

-- Eliminar políticas anteriores restrictivas y agregar nuevas
DROP POLICY IF EXISTS "Admin puede gestionar insurance types" ON insurance_types;

CREATE POLICY "Admin y Gerente pueden insertar insurance types"
  ON insurance_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admin y Gerente pueden actualizar insurance types"
  ON insurance_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admin y Gerente pueden eliminar insurance types"
  ON insurance_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tramite_activity_types_activo
  ON tramite_activity_types(activo) WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_insurance_types_activo
  ON insurance_types(activo) WHERE activo = true;

CREATE INDEX IF NOT EXISTS idx_aseguradoras_activo
  ON aseguradoras(activo) WHERE activo = true;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE tramite_activity_types IS 'Catálogo de tipos de trámite para Registro de Actividades (editable por Admin y Gerente)';
COMMENT ON TABLE insurance_types IS 'Catálogo de tipos de seguro para Registro de Actividades (editable por Admin y Gerente)';
