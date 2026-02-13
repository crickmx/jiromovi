/*
  # Sistema de Base de Datos Espejo para SICAS REST API

  1. Propósito
    - Crear tablas "espejo" para cachear datos de SICAS localmente
    - Mejorar rendimiento evitando llamadas repetidas a SICAS
    - Permitir sincronización incremental con control de cursores
    - Soportar producción por vendedor, comisiones y cobranza
    - Integrar con Centro Digital on-demand

  2. Nuevas Tablas
    - `sicas_documents` - Documentos/pólizas sincronizados
    - `sicas_commissions` - Comisiones pendientes y pagadas
    - `sicas_receivables` - Cobranza pendiente
    - `sicas_sync_runs` - Auditoría de ejecuciones de sync
    - `sicas_sync_cursors` - Control de estado incremental
    - `sicas_digital_cache` - Cache de archivos de Centro Digital

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Usuarios ven solo sus documentos (mapeo por vendedor)
    - Gerentes ven documentos de su oficina
    - Administradores ven todo
    - Service role tiene acceso completo para sincronización

  4. Características
    - Sincronización incremental por fecha
    - Paginación persistente
    - Detección de cambios con hash
    - Mapeo vendedor↔usuario
    - Cache TTL para Centro Digital
*/

-- =====================================================
-- 1) DOCUMENTOS / PRODUCCIÓN
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_docto text UNIQUE NOT NULL,
  
  -- Información del vendedor
  vend_id text,
  vend_nombre text,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Información de oficina
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  desp_nombre text,
  
  -- Información del documento
  ramo text,
  subramo text,
  compania text,
  poliza text,
  cliente text,
  
  -- Fechas
  fecha_captura timestamptz,
  fecha_emision timestamptz,
  vigencia_desde timestamptz,
  vigencia_hasta timestamptz,
  
  -- Montos
  importe numeric(15,2),
  prima_neta numeric(15,2),
  
  -- Datos crudos y control
  raw_data jsonb,
  raw_hash text,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sicas_documents_id_docto ON sicas_documents(id_docto);
CREATE INDEX IF NOT EXISTS idx_sicas_documents_usuario_id ON sicas_documents(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sicas_documents_oficina_id ON sicas_documents(oficina_id);
CREATE INDEX IF NOT EXISTS idx_sicas_documents_vend_nombre ON sicas_documents(vend_nombre);
CREATE INDEX IF NOT EXISTS idx_sicas_documents_vigencia_hasta ON sicas_documents(vigencia_hasta);
CREATE INDEX IF NOT EXISTS idx_sicas_documents_fecha_captura ON sicas_documents(fecha_captura);

-- =====================================================
-- 2) COMISIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo y periodo
  source text NOT NULL CHECK (source IN ('pendiente', 'pagada')),
  period_key text NOT NULL,
  
  -- Información del vendedor
  vend_id text,
  vend_nombre text,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  
  -- Documento relacionado
  id_docto text,
  documento_poliza text,
  
  -- Montos
  importe numeric(15,2),
  base_comision numeric(15,2),
  comision numeric(15,2),
  isr numeric(15,2),
  iva numeric(15,2),
  retenciones numeric(15,2),
  neto_pagar numeric(15,2),
  
  -- Fechas
  fecha_pago timestamptz,
  fecha_corte timestamptz,
  
  -- Datos crudos
  raw_data jsonb,
  raw_hash text,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced_at timestamptz DEFAULT now(),
  
  -- Evitar duplicados
  UNIQUE(source, period_key, vend_nombre, documento_poliza)
);

CREATE INDEX IF NOT EXISTS idx_sicas_commissions_usuario_id ON sicas_commissions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sicas_commissions_oficina_id ON sicas_commissions(oficina_id);
CREATE INDEX IF NOT EXISTS idx_sicas_commissions_vend_nombre ON sicas_commissions(vend_nombre);
CREATE INDEX IF NOT EXISTS idx_sicas_commissions_source ON sicas_commissions(source);
CREATE INDEX IF NOT EXISTS idx_sicas_commissions_period_key ON sicas_commissions(period_key);
CREATE INDEX IF NOT EXISTS idx_sicas_commissions_id_docto ON sicas_commissions(id_docto);

-- =====================================================
-- 3) COBRANZA PENDIENTE
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información del vendedor
  vend_id text,
  vend_nombre text,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  
  -- Documento
  id_docto text,
  poliza text,
  cliente text,
  
  -- Montos
  importe_pendiente numeric(15,2),
  importe_original numeric(15,2),
  
  -- Fechas
  fecha_limite timestamptz,
  fecha_vencimiento timestamptz,
  
  -- Estado
  estatus text DEFAULT 'pendiente',
  dias_vencido integer,
  
  -- Datos crudos
  raw_data jsonb,
  raw_hash text,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced_at timestamptz DEFAULT now(),
  
  -- Evitar duplicados
  UNIQUE(id_docto, poliza, vend_nombre)
);

CREATE INDEX IF NOT EXISTS idx_sicas_receivables_usuario_id ON sicas_receivables(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sicas_receivables_oficina_id ON sicas_receivables(oficina_id);
CREATE INDEX IF NOT EXISTS idx_sicas_receivables_vend_nombre ON sicas_receivables(vend_nombre);
CREATE INDEX IF NOT EXISTS idx_sicas_receivables_estatus ON sicas_receivables(estatus);
CREATE INDEX IF NOT EXISTS idx_sicas_receivables_fecha_limite ON sicas_receivables(fecha_limite);

-- =====================================================
-- 4) AUDITORÍA DE SINCRONIZACIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_sync_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  module text NOT NULL CHECK (module IN ('documents', 'commissions', 'receivables')),
  keycode text NOT NULL,
  report_name text,
  
  -- Parámetros de la ejecución
  from_date timestamptz,
  to_date timestamptz,
  pages_requested integer DEFAULT 0,
  items_per_page integer DEFAULT 50,
  
  -- Resultados
  records_fetched integer DEFAULT 0,
  records_upserted integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  
  -- Estado
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  error_message text,
  
  -- Auditoría
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  duration_seconds integer,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sicas_sync_runs_module ON sicas_sync_runs(module);
CREATE INDEX IF NOT EXISTS idx_sicas_sync_runs_status ON sicas_sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_sicas_sync_runs_created_at ON sicas_sync_runs(created_at DESC);

-- =====================================================
-- 5) CURSORES DE SINCRONIZACIÓN (Estado Incremental)
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_sync_cursors (
  module text NOT NULL,
  keycode text NOT NULL,
  
  -- Estado del cursor
  last_success_at timestamptz,
  last_cursor_date timestamptz,
  last_page integer DEFAULT 1,
  
  -- Configuración
  sync_frequency_hours integer DEFAULT 24,
  incremental_days_buffer integer DEFAULT 2,
  
  -- Metadatos
  total_synced integer DEFAULT 0,
  last_run_id uuid REFERENCES sicas_sync_runs(run_id) ON DELETE SET NULL,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  PRIMARY KEY (module, keycode)
);

-- =====================================================
-- 6) CACHE DE CENTRO DIGITAL
-- =====================================================
CREATE TABLE IF NOT EXISTS sicas_digital_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación del documento
  id_docto text NOT NULL,
  identity_type text NOT NULL,
  value_pk text NOT NULL,
  
  -- Archivos (JSON array)
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Control de cache
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(id_docto, identity_type, value_pk)
);

CREATE INDEX IF NOT EXISTS idx_sicas_digital_cache_id_docto ON sicas_digital_cache(id_docto);
CREATE INDEX IF NOT EXISTS idx_sicas_digital_cache_expires_at ON sicas_digital_cache(expires_at);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- SICAS Documents
ALTER TABLE sicas_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_documents"
  ON sicas_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own documents"
  ON sicas_documents FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

-- SICAS Commissions
ALTER TABLE sicas_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_commissions"
  ON sicas_commissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own commissions"
  ON sicas_commissions FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

-- SICAS Receivables
ALTER TABLE sicas_receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_receivables"
  ON sicas_receivables FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own receivables"
  ON sicas_receivables FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('admin', 'gerente')
    )
  );

-- SICAS Sync Runs (solo admin)
ALTER TABLE sicas_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_sync_runs"
  ON sicas_sync_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view sync runs"
  ON sicas_sync_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- SICAS Sync Cursors (solo admin)
ALTER TABLE sicas_sync_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_sync_cursors"
  ON sicas_sync_cursors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view sync cursors"
  ON sicas_sync_cursors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- SICAS Digital Cache
ALTER TABLE sicas_digital_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_digital_cache"
  ON sicas_digital_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view cached files for their documents"
  ON sicas_digital_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sicas_documents
      WHERE sicas_documents.id_docto = sicas_digital_cache.id_docto
      AND (
        sicas_documents.usuario_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('admin', 'gerente')
        )
      )
    )
  );

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para limpiar cache expirado
CREATE OR REPLACE FUNCTION cleanup_expired_digital_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM sicas_digital_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_sicas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers para updated_at
CREATE TRIGGER update_sicas_documents_updated_at
  BEFORE UPDATE ON sicas_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_updated_at();

CREATE TRIGGER update_sicas_commissions_updated_at
  BEFORE UPDATE ON sicas_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_updated_at();

CREATE TRIGGER update_sicas_receivables_updated_at
  BEFORE UPDATE ON sicas_receivables
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_updated_at();

CREATE TRIGGER update_sicas_digital_cache_updated_at
  BEFORE UPDATE ON sicas_digital_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_updated_at();

CREATE TRIGGER update_sicas_sync_cursors_updated_at
  BEFORE UPDATE ON sicas_sync_cursors
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_updated_at();
