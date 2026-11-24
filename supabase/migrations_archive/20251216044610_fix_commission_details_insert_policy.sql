/*
  # Fix Commission Details INSERT Policy

  1. Propósito
    - Asegurar que service_role puede hacer INSERT en commission_details
    - Corregir la política de admin para permitir INSERT con with_check
    
  2. Cambios
    - Recrear política de service_role con INSERT explícito
    - Actualizar política de admin con with_check correcto
    
  3. Seguridad
    - Service role mantiene acceso completo
    - Admins pueden gestionar todas las comisiones
*/

-- Drop y recrear política de admin con with_check correcto
DROP POLICY IF EXISTS "Admins manage commission details" ON commission_details;

CREATE POLICY "Admins manage commission details"
  ON commission_details
  FOR ALL
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

-- Asegurar que service_role tiene acceso completo
DROP POLICY IF EXISTS "Service role can manage details" ON commission_details;

CREATE POLICY "Service role can manage details"
  ON commission_details
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
