/*
  # Corrección Crítica: RLS de sicas_catalogos con Roles Correctos

  1. Problema
    - Políticas RLS usaban 'admin' y 'gerente' en minúsculas
    - Roles reales son 'Administrador' y 'Gerente' con mayúscula
    - Esto bloqueaba acceso a administradores en la página de mapeo SICAS

  2. Solución
    - Reemplazar todas las políticas con roles correctos
    - Agregar política para service_role correcta
    - Simplificar políticas duplicadas

  3. Impacto
    - Administradores podrán acceder a /sicas sin ser redirigidos
    - Gerentes podrán ver catálogos SICAS
    - Service role funciona para edge functions
*/

-- ==============================================
-- TABLA: sicas_catalogos
-- ==============================================

-- Eliminar políticas anteriores incorrectas
DROP POLICY IF EXISTS "Admins can delete SICAS catalogs" ON sicas_catalogos;
DROP POLICY IF EXISTS "Admins can insert SICAS catalogs" ON sicas_catalogos;
DROP POLICY IF EXISTS "Admins can update SICAS catalogs" ON sicas_catalogos;
DROP POLICY IF EXISTS "Allow admins and gerentes to view catalogos" ON sicas_catalogos;
DROP POLICY IF EXISTS "Authenticated users can view SICAS catalogs" ON sicas_catalogos;
DROP POLICY IF EXISTS "Service role tiene acceso completo a catalogos" ON sicas_catalogos;

-- Crear políticas correctas con roles en mayúscula
CREATE POLICY "Administrador y Gerente pueden ver catalogos SICAS"
  ON sicas_catalogos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Administrador puede insertar catalogos SICAS"
  ON sicas_catalogos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Administrador puede actualizar catalogos SICAS"
  ON sicas_catalogos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Administrador puede eliminar catalogos SICAS"
  ON sicas_catalogos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role gestiona catalogos SICAS"
  ON sicas_catalogos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- TABLA: sicas_config
-- ==============================================

ALTER TABLE sicas_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administrador gestiona config SICAS" ON sicas_config;
DROP POLICY IF EXISTS "Service role gestiona config SICAS" ON sicas_config;

CREATE POLICY "Administrador gestiona config SICAS"
  ON sicas_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role gestiona config SICAS"
  ON sicas_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- TABLA: sicas_catalog_types
-- ==============================================

ALTER TABLE sicas_catalog_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administrador y Gerente ven tipos de catalogo" ON sicas_catalog_types;
DROP POLICY IF EXISTS "Service role gestiona tipos de catalogo" ON sicas_catalog_types;

CREATE POLICY "Administrador y Gerente ven tipos de catalogo SICAS"
  ON sicas_catalog_types
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Administrador gestiona tipos de catalogo SICAS"
  ON sicas_catalog_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role gestiona tipos de catalogo SICAS"
  ON sicas_catalog_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- TABLA: sicas_sync_history
-- ==============================================

ALTER TABLE sicas_sync_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administrador ve historial sync" ON sicas_sync_history;
DROP POLICY IF EXISTS "Service role gestiona historial sync" ON sicas_sync_history;

CREATE POLICY "Administrador y Gerente ven historial sync SICAS"
  ON sicas_sync_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role gestiona historial sync SICAS"
  ON sicas_sync_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- Comentarios de documentación
-- ==============================================

COMMENT ON POLICY "Administrador y Gerente pueden ver catalogos SICAS" ON sicas_catalogos IS 
  'Administradores y Gerentes pueden ver todos los catálogos SICAS (despachos, vendedores, etc)';

COMMENT ON POLICY "Administrador puede insertar catalogos SICAS" ON sicas_catalogos IS 
  'Solo Administradores pueden insertar nuevos registros de catálogos SICAS';

COMMENT ON POLICY "Administrador puede actualizar catalogos SICAS" ON sicas_catalogos IS 
  'Solo Administradores pueden actualizar catálogos SICAS existentes';

COMMENT ON POLICY "Administrador puede eliminar catalogos SICAS" ON sicas_catalogos IS 
  'Solo Administradores pueden eliminar catálogos SICAS';

COMMENT ON POLICY "Service role gestiona catalogos SICAS" ON sicas_catalogos IS 
  'Service role tiene acceso completo para sincronizaciones automáticas vía edge functions';
