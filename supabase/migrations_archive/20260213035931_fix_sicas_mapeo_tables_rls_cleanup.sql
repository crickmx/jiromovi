/*
  # Limpieza de RLS en Tablas de Mapeo SICAS

  1. Problema
    - Políticas duplicadas con roles incorrectos ('admin', 'gerente')
    - Mezcla de políticas antiguas y nuevas
    - Políticas contradictorias (algunas permiten todo, otras restringen)

  2. Solución
    - Eliminar TODAS las políticas existentes
    - Crear políticas limpias con roles correctos
    - Simplificar estructura de permisos

  3. Estructura Final
    - Administrador: Acceso completo
    - Gerente: Solo su oficina (para despachos) o usuarios de su oficina (para vendedores)
    - Usuario: Ve su propio mapeo de vendedor
    - Service role: Acceso completo
*/

-- ==============================================
-- TABLA: sicas_mapeo_despacho_oficina
-- ==============================================

-- Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Administrador gestiona mapeo despachos" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins and gerentes can delete despacho mappings" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins and gerentes can insert despacho mappings" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Admins and gerentes can update despacho mappings" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Allow admins and gerentes full access to despacho mappings" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Authenticated users can view despacho mappings" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Gerente ve mapeo de su oficina despacho" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Service role gestiona mapeo despachos" ON sicas_mapeo_despacho_oficina;

-- Crear políticas limpias y correctas
CREATE POLICY "Administrador gestiona mapeo despachos SICAS"
  ON sicas_mapeo_despacho_oficina
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

CREATE POLICY "Gerente ve y gestiona mapeo de su oficina"
  ON sicas_mapeo_despacho_oficina
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.deleted_at IS NULL
        AND u.oficina_id = sicas_mapeo_despacho_oficina.movi_oficina_id
    )
  );

CREATE POLICY "Service role gestiona mapeo despachos SICAS"
  ON sicas_mapeo_despacho_oficina
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- TABLA: sicas_mapeo_vendedor_usuario
-- ==============================================

-- Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Administrador gestiona mapeo vendedores" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins and gerentes can delete vendedor mappings" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins and gerentes can insert vendedor mappings" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Admins and gerentes can update vendedor mappings" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Allow admins and gerentes full access to vendedor mappings" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Authenticated users can view vendedor mappings" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Gerente ve mapeo de su oficina" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Usuario ve su propio mapeo vendedor" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Service role gestiona mapeo vendedores" ON sicas_mapeo_vendedor_usuario;

-- Crear políticas limpias y correctas
CREATE POLICY "Administrador gestiona mapeo vendedores SICAS"
  ON sicas_mapeo_vendedor_usuario
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

CREATE POLICY "Usuario ve su propio mapeo de vendedor"
  ON sicas_mapeo_vendedor_usuario
  FOR SELECT
  TO authenticated
  USING (
    movi_user_id = auth.uid()
  );

CREATE POLICY "Gerente ve y gestiona mapeo de usuarios de su oficina"
  ON sicas_mapeo_vendedor_usuario
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM usuarios u2
          WHERE u2.id = sicas_mapeo_vendedor_usuario.movi_user_id
            AND u2.oficina_id = u.oficina_id
            AND u2.deleted_at IS NULL
        )
    )
  );

CREATE POLICY "Service role gestiona mapeo vendedores SICAS"
  ON sicas_mapeo_vendedor_usuario
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- Verificar que oficinas tenga RLS correcto
-- ==============================================

-- Las oficinas ya deberían tener RLS, pero verificamos
ALTER TABLE oficinas ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas viejas si existen
DROP POLICY IF EXISTS "Authenticated users can view offices" ON oficinas;
DROP POLICY IF EXISTS "Admins can manage offices" ON oficinas;

-- Políticas correctas para oficinas (necesarias para los selects en mapeo)
CREATE POLICY "Todos los usuarios autenticados ven oficinas"
  ON oficinas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Administrador gestiona oficinas"
  ON oficinas
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

CREATE POLICY "Service role gestiona oficinas"
  ON oficinas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- Comentarios de documentación
-- ==============================================

COMMENT ON POLICY "Administrador gestiona mapeo despachos SICAS" ON sicas_mapeo_despacho_oficina IS 
  'Administradores tienen acceso completo para mapear despachos SICAS a oficinas';

COMMENT ON POLICY "Gerente ve y gestiona mapeo de su oficina" ON sicas_mapeo_despacho_oficina IS 
  'Gerentes pueden ver y gestionar mapeos de despachos solo de su oficina';

COMMENT ON POLICY "Administrador gestiona mapeo vendedores SICAS" ON sicas_mapeo_vendedor_usuario IS 
  'Administradores tienen acceso completo para mapear vendedores SICAS a usuarios';

COMMENT ON POLICY "Usuario ve su propio mapeo de vendedor" ON sicas_mapeo_vendedor_usuario IS 
  'Usuarios pueden ver su propio mapeo de vendedor SICAS';

COMMENT ON POLICY "Gerente ve y gestiona mapeo de usuarios de su oficina" ON sicas_mapeo_vendedor_usuario IS 
  'Gerentes pueden ver y gestionar mapeos de vendedores solo de usuarios de su oficina';
