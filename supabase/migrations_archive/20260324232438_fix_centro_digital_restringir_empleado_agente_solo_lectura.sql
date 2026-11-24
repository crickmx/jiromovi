/*
  # Fix Centro Digital - Restringir Empleado y Agente a solo lectura

  ## Cambio
  - Empleado y Agente NO pueden subir archivos
  - Solo pueden ver y descargar archivos asignados
  - Solo Admin y Gerente pueden subir archivos

  ## Políticas Actualizadas
  - INSERT: Solo Admin y Gerente
  - UPDATE: Solo Admin y Gerente
  - DELETE: Solo Admin
  - SELECT: Todos según visibilidad
*/

-- =====================================================
-- ELIMINAR POLÍTICAS ANTIGUAS DE INSERT/UPDATE
-- =====================================================

DROP POLICY IF EXISTS "Staff: insert archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Staff: update own archivos" ON centro_digital_archivos;

-- =====================================================
-- NUEVA POLÍTICA INSERT: Solo Admin y Gerente
-- =====================================================

CREATE POLICY "Admin and Gerente: insert archivos"
  ON centro_digital_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
    AND usuario_puede_ver_carpeta(carpeta_id)
  );

-- =====================================================
-- NUEVA POLÍTICA UPDATE: Solo Admin y Gerente
-- =====================================================

CREATE POLICY "Admin and Gerente: update archivos"
  ON centro_digital_archivos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
    AND usuario_puede_gestionar_archivo(id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
    AND usuario_puede_gestionar_archivo(id)
  );

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON POLICY "Admin and Gerente: insert archivos" ON centro_digital_archivos IS 
'Solo Administradores y Gerentes pueden subir archivos. Empleados y Agentes tienen acceso de solo lectura.';

COMMENT ON POLICY "Admin and Gerente: update archivos" ON centro_digital_archivos IS 
'Solo Administradores y Gerentes pueden editar archivos. Empleados y Agentes tienen acceso de solo lectura.';
