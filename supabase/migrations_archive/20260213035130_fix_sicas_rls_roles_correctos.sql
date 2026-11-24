/*
  # Corrección Crítica: RLS SICAS con Roles Correctos

  1. Problema
    - Las políticas RLS usaban 'admin' y 'gerente' en minúsculas
    - Los roles reales son 'Administrador' y 'Gerente' con mayúscula
    - Esto causaba que las políticas NO funcionaran correctamente

  2. Solución
    - Reemplazar todas las políticas RLS con los nombres correctos
    - Agregar políticas para las vistas también
    - Asegurar filtrado estricto por rol

  3. Seguridad
    - Agente: Solo ve sus datos (vía mapeo vendedor)
    - Gerente: Solo ve su oficina (vía mapeo despacho u oficina de usuarios)
    - Administrador: Ve todo
    - Service role: Gestiona todo (para edge functions)
*/

-- ==============================================
-- TABLA: sicas_polizas_vigentes
-- ==============================================

-- Eliminar políticas anteriores incorrectas
DROP POLICY IF EXISTS "Admin ve todas las polizas" ON sicas_polizas_vigentes;
DROP POLICY IF EXISTS "Agente ve solo sus polizas" ON sicas_polizas_vigentes;
DROP POLICY IF EXISTS "Gerente ve polizas de su oficina" ON sicas_polizas_vigentes;
DROP POLICY IF EXISTS "Service role gestiona polizas" ON sicas_polizas_vigentes;

-- Crear políticas correctas con roles en mayúscula
CREATE POLICY "Administrador ve todas las polizas SICAS"
  ON sicas_polizas_vigentes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Agente ve solo sus polizas SICAS"
  ON sicas_polizas_vigentes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN sicas_mapeo_vendedor_usuario mvu ON mvu.movi_user_id = u.id
      WHERE u.id = auth.uid()
        AND u.deleted_at IS NULL
        AND mvu.id_sicas_vendedor = sicas_polizas_vigentes.vend_id
    )
  );

CREATE POLICY "Gerente ve polizas de su oficina SICAS"
  ON sicas_polizas_vigentes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.deleted_at IS NULL
        AND (
          -- Opción 1: A través del mapeo de despacho
          EXISTS (
            SELECT 1 FROM sicas_mapeo_despacho_oficina mdo
            WHERE mdo.id_sicas_despacho = sicas_polizas_vigentes.desp_id
              AND mdo.movi_oficina_id = u.oficina_id
          )
          OR
          -- Opción 2: A través del vendedor que pertenece a la oficina
          EXISTS (
            SELECT 1 
            FROM sicas_mapeo_vendedor_usuario mvu
            JOIN usuarios u2 ON u2.id = mvu.movi_user_id
            WHERE mvu.id_sicas_vendedor = sicas_polizas_vigentes.vend_id
              AND u2.oficina_id = u.oficina_id
              AND u2.deleted_at IS NULL
          )
        )
    )
  );

CREATE POLICY "Service role gestiona polizas SICAS"
  ON sicas_polizas_vigentes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- TABLA: sicas_cobranza_pendiente
-- ==============================================

-- Eliminar políticas anteriores incorrectas
DROP POLICY IF EXISTS "Admin ve toda cobranza" ON sicas_cobranza_pendiente;
DROP POLICY IF EXISTS "Agente ve solo su cobranza" ON sicas_cobranza_pendiente;
DROP POLICY IF EXISTS "Gerente ve cobranza de su oficina" ON sicas_cobranza_pendiente;
DROP POLICY IF EXISTS "Service role gestiona cobranza" ON sicas_cobranza_pendiente;

-- Crear políticas correctas
CREATE POLICY "Administrador ve toda cobranza SICAS"
  ON sicas_cobranza_pendiente
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Agente ve solo su cobranza SICAS"
  ON sicas_cobranza_pendiente
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN sicas_mapeo_vendedor_usuario mvu ON mvu.movi_user_id = u.id
      WHERE u.id = auth.uid()
        AND u.deleted_at IS NULL
        AND mvu.id_sicas_vendedor = sicas_cobranza_pendiente.vend_id
    )
  );

CREATE POLICY "Gerente ve cobranza de su oficina SICAS"
  ON sicas_cobranza_pendiente
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 
          FROM sicas_mapeo_vendedor_usuario mvu
          JOIN usuarios u2 ON u2.id = mvu.movi_user_id
          WHERE mvu.id_sicas_vendedor = sicas_cobranza_pendiente.vend_id
            AND u2.oficina_id = u.oficina_id
            AND u2.deleted_at IS NULL
        )
    )
  );

CREATE POLICY "Service role gestiona cobranza SICAS"
  ON sicas_cobranza_pendiente
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- TABLA: sicas_mapeo_vendedor_usuario
-- ==============================================

-- Verificar RLS está habilitado
ALTER TABLE sicas_mapeo_vendedor_usuario ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Administrador gestiona mapeo vendedores" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Usuarios ven su propio mapeo" ON sicas_mapeo_vendedor_usuario;
DROP POLICY IF EXISTS "Gerente ve mapeo de su oficina" ON sicas_mapeo_vendedor_usuario;

-- Administrador gestiona todo el mapeo
CREATE POLICY "Administrador gestiona mapeo vendedores"
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

-- Usuario ve su propio mapeo
CREATE POLICY "Usuario ve su propio mapeo vendedor"
  ON sicas_mapeo_vendedor_usuario
  FOR SELECT
  TO authenticated
  USING (
    movi_user_id = auth.uid()
  );

-- Gerente ve mapeo de usuarios de su oficina
CREATE POLICY "Gerente ve mapeo de su oficina"
  ON sicas_mapeo_vendedor_usuario
  FOR SELECT
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

-- Service role tiene acceso completo
CREATE POLICY "Service role gestiona mapeo vendedores"
  ON sicas_mapeo_vendedor_usuario
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- TABLA: sicas_mapeo_despacho_oficina
-- ==============================================

ALTER TABLE sicas_mapeo_despacho_oficina ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Administrador gestiona mapeo despachos" ON sicas_mapeo_despacho_oficina;
DROP POLICY IF EXISTS "Gerente ve mapeo de su oficina despacho" ON sicas_mapeo_despacho_oficina;

CREATE POLICY "Administrador gestiona mapeo despachos"
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

CREATE POLICY "Gerente ve mapeo de su oficina despacho"
  ON sicas_mapeo_despacho_oficina
  FOR SELECT
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

CREATE POLICY "Service role gestiona mapeo despachos"
  ON sicas_mapeo_despacho_oficina
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================
-- ÍNDICES PARA OPTIMIZAR QUERIES RLS
-- ==============================================

-- Índice para búsquedas por vendedor (usado frecuentemente en RLS)
CREATE INDEX IF NOT EXISTS idx_sicas_polizas_vend_id 
  ON sicas_polizas_vigentes(vend_id);

CREATE INDEX IF NOT EXISTS idx_sicas_cobranza_vend_id 
  ON sicas_cobranza_pendiente(vend_id);

-- Índice para búsquedas por despacho
CREATE INDEX IF NOT EXISTS idx_sicas_polizas_desp_id 
  ON sicas_polizas_vigentes(desp_id);

-- Índice en mapeo para JOIN rápido
CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_vendedor_movi_user 
  ON sicas_mapeo_vendedor_usuario(movi_user_id);

CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_vendedor_sicas_id 
  ON sicas_mapeo_vendedor_usuario(id_sicas_vendedor);

CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_despacho_oficina 
  ON sicas_mapeo_despacho_oficina(movi_oficina_id);

-- Comentarios de documentación
COMMENT ON POLICY "Administrador ve todas las polizas SICAS" ON sicas_polizas_vigentes IS 
  'Administradores ven todas las pólizas SICAS sin restricción';

COMMENT ON POLICY "Agente ve solo sus polizas SICAS" ON sicas_polizas_vigentes IS 
  'Agentes solo ven pólizas donde están mapeados como vendedor SICAS';

COMMENT ON POLICY "Gerente ve polizas de su oficina SICAS" ON sicas_polizas_vigentes IS 
  'Gerentes ven pólizas de vendedores de su oficina o despachos mapeados a su oficina';
