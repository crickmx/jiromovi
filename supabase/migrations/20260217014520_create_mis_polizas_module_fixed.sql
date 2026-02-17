/*
  # Módulo "Mis Pólizas" con Centro Digital

  1. Propósito
    - Permitir a usuarios consultar SUS pólizas vigentes desde SICAS
    - Acceso al Centro Digital por póliza
    - Permisos por rol: Admin (todas), Gerente (oficina), Agente (suyas)
    - Mapeo usuario ↔ IDs SICAS (vendedor, oficina, gerencia)

  2. Nuevas Tablas
    - `sicas_user_mapping` - Mapeo usuario app ↔ IDs SICAS
    - `sicas_centro_digital_cache` - Cache de archivos del Centro Digital
    - `sicas_config` - Configuración de KeyCodes y parámetros

  3. Seguridad
    - RLS por rol en todas las tablas
    - Admin: acceso total
    - Gerente: solo su(s) oficina(s)
    - Agente: solo sus pólizas (por vendedor SICAS mapeado)
    - Empleado: solo su(s) oficina(s)
*/

-- =====================================================
-- 1) MAPEO USUARIO ↔ SICAS IDs
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_user_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- IDs de SICAS
  sicas_id_vendedor text,
  sicas_id_oficina text,
  sicas_id_gerencia text,
  sicas_id_despacho text,
  
  -- Nombres para referencia (se sincronizan de SICAS)
  sicas_nombre_vendedor text,
  sicas_nombre_oficina text,
  sicas_nombre_gerencia text,
  sicas_nombre_despacho text,
  
  -- Configuración
  es_mapeo_principal boolean DEFAULT true,
  activo boolean DEFAULT true,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint: un usuario puede tener múltiples mapeos, pero solo uno principal
  UNIQUE(usuario_id, sicas_id_vendedor)
);

CREATE INDEX IF NOT EXISTS idx_sicas_user_mapping_usuario_id ON sicas_user_mapping(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sicas_user_mapping_vendedor ON sicas_user_mapping(sicas_id_vendedor);
CREATE INDEX IF NOT EXISTS idx_sicas_user_mapping_oficina ON sicas_user_mapping(sicas_id_oficina);

-- =====================================================
-- 2) CACHE DE ARCHIVOS DEL CENTRO DIGITAL
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_centro_digital_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación del documento
  id_docto text NOT NULL,
  id_cont text,
  identity_type text NOT NULL, -- H02 (Póliza), H03 (Recibo), etc.
  
  -- Archivos (JSON array)
  archivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadatos
  total_archivos integer DEFAULT 0,
  tiene_archivos boolean DEFAULT false,
  
  -- Control de cache
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(id_docto, identity_type)
);

CREATE INDEX IF NOT EXISTS idx_sicas_centro_digital_id_docto ON sicas_centro_digital_cache(id_docto);
CREATE INDEX IF NOT EXISTS idx_sicas_centro_digital_expires ON sicas_centro_digital_cache(expires_at);

-- =====================================================
-- 3) CONFIGURACIÓN DE SICAS
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Configuración de reportes
  keycode_polizas_vigentes text DEFAULT 'H03400',
  keycode_polizas_todas text DEFAULT 'HWSDOC',
  keycode_centro_digital text DEFAULT 'H02',
  
  -- Configuración de paginación
  items_per_page_default integer DEFAULT 100,
  items_per_page_max integer DEFAULT 500,
  
  -- Configuración de cache
  cache_ttl_minutes integer DEFAULT 10,
  
  -- Configuración de filtros (JSON)
  filtros_habilitados jsonb DEFAULT '{
    "estatus": true,
    "fecha_vigencia": true,
    "fecha_captura": true,
    "oficina": true,
    "vendedor": true,
    "aseguradora": true,
    "ramo": true,
    "subramo": true,
    "tipo_documento": true
  }'::jsonb,
  
  -- Modo debug
  debug_mode boolean DEFAULT false,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insertar configuración por defecto
INSERT INTO sicas_config (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- SICAS User Mapping
ALTER TABLE sicas_user_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_user_mapping"
  ON sicas_user_mapping FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own mapping"
  ON sicas_user_mapping FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

CREATE POLICY "Admins can manage all mappings"
  ON sicas_user_mapping FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- SICAS Centro Digital Cache
ALTER TABLE sicas_centro_digital_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on centro_digital_cache"
  ON sicas_centro_digital_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view cached files for their documents"
  ON sicas_centro_digital_cache FOR SELECT
  TO authenticated
  USING (
    -- Admin ve todo
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
    OR
    -- Usuario ve solo archivos de sus documentos
    EXISTS (
      SELECT 1 FROM sicas_documents sd
      WHERE sd.id_docto = sicas_centro_digital_cache.id_docto
      AND (
        sd.usuario_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND u.rol = 'gerente'
          AND sd.oficina_id = u.oficina_id
        )
      )
    )
  );

-- SICAS Config (solo admin puede editar, todos leen)
ALTER TABLE sicas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_config"
  ON sicas_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Everyone can read sicas_config"
  ON sicas_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update sicas_config"
  ON sicas_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para limpiar cache expirado de Centro Digital
CREATE OR REPLACE FUNCTION cleanup_expired_centro_digital_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM sicas_centro_digital_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Función para obtener mapeo SICAS de un usuario
CREATE OR REPLACE FUNCTION get_user_sicas_mapping(p_usuario_id uuid)
RETURNS TABLE (
  sicas_id_vendedor text,
  sicas_id_oficina text,
  sicas_id_gerencia text,
  sicas_nombre_vendedor text,
  sicas_nombre_oficina text,
  rol text,
  oficina_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sum.sicas_id_vendedor,
    sum.sicas_id_oficina,
    sum.sicas_id_gerencia,
    sum.sicas_nombre_vendedor,
    sum.sicas_nombre_oficina,
    u.rol::text,
    u.oficina_id
  FROM usuarios u
  LEFT JOIN sicas_user_mapping sum ON sum.usuario_id = u.id AND sum.es_mapeo_principal = true
  WHERE u.id = p_usuario_id;
END;
$$;

-- Función para verificar si un usuario puede ver una póliza
CREATE OR REPLACE FUNCTION user_can_view_poliza(
  p_usuario_id uuid,
  p_id_docto text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rol text;
  v_oficina_id uuid;
  v_doc_oficina_id uuid;
  v_doc_usuario_id uuid;
BEGIN
  -- Obtener rol y oficina del usuario
  SELECT rol, oficina_id INTO v_rol, v_oficina_id
  FROM usuarios
  WHERE id = p_usuario_id;
  
  -- Admin ve todo
  IF v_rol = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Obtener info del documento
  SELECT oficina_id, usuario_id INTO v_doc_oficina_id, v_doc_usuario_id
  FROM sicas_documents
  WHERE id_docto = p_id_docto;
  
  -- Gerente/Empleado: ve si el documento es de su oficina
  IF v_rol IN ('gerente', 'empleado') THEN
    RETURN v_doc_oficina_id = v_oficina_id;
  END IF;
  
  -- Agente: ve solo sus documentos
  IF v_rol = 'agente' THEN
    RETURN v_doc_usuario_id = p_usuario_id;
  END IF;
  
  RETURN false;
END;
$$;

-- Trigger para updated_at
CREATE TRIGGER update_sicas_user_mapping_updated_at
  BEFORE UPDATE ON sicas_user_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_updated_at();

CREATE TRIGGER update_sicas_centro_digital_cache_updated_at2
  BEFORE UPDATE ON sicas_centro_digital_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_updated_at();

CREATE TRIGGER update_sicas_config_updated_at
  BEFORE UPDATE ON sicas_config
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_updated_at();
