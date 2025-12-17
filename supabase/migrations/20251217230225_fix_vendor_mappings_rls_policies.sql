/*
  # Fix vendor_mappings RLS Policies

  1. Problema
    - Las políticas RLS buscan rol = 'admin'
    - El rol correcto en la tabla usuarios es 'Administrador'
    - Esto causaba: "new row violates row-level security policy"

  2. Solución
    - Actualizar todas las políticas RLS para usar 'Administrador'
    - Permitir que administradores puedan crear/actualizar/eliminar mapeos

  3. Security
    - Mantener restricción: Solo administradores
    - Sin recursión RLS
*/

-- ============================================
-- ELIMINAR POLÍTICAS EXISTENTES
-- ============================================

DROP POLICY IF EXISTS "Admins pueden ver todos los mapeos" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins pueden crear mapeos" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins pueden actualizar mapeos" ON vendor_mappings;
DROP POLICY IF EXISTS "Admins pueden eliminar mapeos" ON vendor_mappings;

-- ============================================
-- CREAR POLÍTICAS CORREGIDAS
-- ============================================

-- Ver mapeos: Solo administradores
CREATE POLICY "Administradores pueden ver todos los mapeos"
  ON vendor_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND estado != 'eliminado'
    )
  );

-- Crear mapeos: Solo administradores
CREATE POLICY "Administradores pueden crear mapeos"
  ON vendor_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND estado != 'eliminado'
    )
  );

-- Actualizar mapeos: Solo administradores
CREATE POLICY "Administradores pueden actualizar mapeos"
  ON vendor_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND estado != 'eliminado'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND estado != 'eliminado'
    )
  );

-- Eliminar mapeos: Solo administradores
CREATE POLICY "Administradores pueden eliminar mapeos"
  ON vendor_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol = 'Administrador'
        AND estado != 'eliminado'
    )
  );

-- ============================================
-- COMENTARIO DE VERIFICACIÓN
-- ============================================

COMMENT ON TABLE vendor_mappings IS 'Mapeos de vendedores externos a usuarios MOVI. Solo accesible por Administradores.';