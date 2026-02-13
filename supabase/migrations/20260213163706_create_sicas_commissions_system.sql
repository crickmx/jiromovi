/*
  # Sistema de Comisiones SICAS

  1. Nuevas Tablas
    - `sicas_comisiones_pendientes`
      - Comisiones pendientes de pago desde SICAS (reporte H03492_ALL)
      - Incluye información de documento, vendedor, póliza, montos y comisiones
      - Mapeo opcional a usuario via vendor_mappings

    - `sicas_comisiones_pagadas`
      - Comisiones ya pagadas desde SICAS (reporte H03797)
      - Incluye información adicional de pago (fecha, forma de pago, etc.)
      - Mapeo opcional a usuario via vendor_mappings

    - `sicas_comisiones_sync_log`
      - Historial de sincronizaciones de comisiones
      - Registra éxito/error, estadísticas y metadata

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Solo administradores y usuarios SICAS pueden ver comisiones
    - Vendedores solo ven sus propias comisiones (via mapeo)

  3. Índices
    - Índices en id_documento, vend_id, no_poliza, fecha_emision
    - Índice en synced_at para queries de sincronización
*/

-- =====================================================
-- COMISIONES PENDIENTES (H03492_ALL)
-- =====================================================

CREATE TABLE IF NOT EXISTS sicas_comisiones_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificadores SICAS
  id_documento text UNIQUE NOT NULL,
  vend_id text NOT NULL,
  vend_nombre text,
  desp_id text,
  desp_nombre text,

  -- Información de Póliza
  no_poliza text,
  aseguradora text,
  ramo text,
  subramo text,
  contratante text,
  asegurado text,

  -- Montos
  prima_neta decimal(15,2),
  prima_total decimal(15,2),
  comision decimal(15,2),
  porcentaje_comision decimal(5,2),

  -- Fechas
  fecha_emision timestamptz,
  fecha_captura timestamptz,
  vigencia_desde date,
  vigencia_hasta date,

  -- Estado
  estado text,

  -- Mapeo a usuario MOVI (opcional)
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Auditoría
  synced_at timestamptz DEFAULT now(),
  raw_data jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para comisiones pendientes
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pendientes_vend_id ON sicas_comisiones_pendientes(vend_id);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pendientes_desp_id ON sicas_comisiones_pendientes(desp_id);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pendientes_usuario_id ON sicas_comisiones_pendientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pendientes_no_poliza ON sicas_comisiones_pendientes(no_poliza);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pendientes_fecha_emision ON sicas_comisiones_pendientes(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pendientes_synced_at ON sicas_comisiones_pendientes(synced_at);

-- =====================================================
-- COMISIONES PAGADAS (H03797)
-- =====================================================

CREATE TABLE IF NOT EXISTS sicas_comisiones_pagadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificadores SICAS
  id_documento text UNIQUE NOT NULL,
  vend_id text NOT NULL,
  vend_nombre text,
  desp_id text,
  desp_nombre text,

  -- Información de Póliza
  no_poliza text,
  aseguradora text,
  ramo text,
  subramo text,
  contratante text,
  asegurado text,

  -- Montos
  prima_neta decimal(15,2),
  prima_total decimal(15,2),
  comision decimal(15,2),
  porcentaje_comision decimal(5,2),

  -- Fechas
  fecha_emision timestamptz,
  fecha_captura timestamptz,
  vigencia_desde date,
  vigencia_hasta date,

  -- Información de Pago
  fecha_pago date,
  forma_pago text,
  referencia_pago text,
  banco text,

  -- Estado
  estado text,

  -- Mapeo a usuario MOVI (opcional)
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Auditoría
  synced_at timestamptz DEFAULT now(),
  raw_data jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para comisiones pagadas
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pagadas_vend_id ON sicas_comisiones_pagadas(vend_id);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pagadas_desp_id ON sicas_comisiones_pagadas(desp_id);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pagadas_usuario_id ON sicas_comisiones_pagadas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pagadas_no_poliza ON sicas_comisiones_pagadas(no_poliza);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pagadas_fecha_emision ON sicas_comisiones_pagadas(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pagadas_fecha_pago ON sicas_comisiones_pagadas(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_pagadas_synced_at ON sicas_comisiones_pagadas(synced_at);

-- =====================================================
-- LOG DE SINCRONIZACIÓN DE COMISIONES
-- =====================================================

CREATE TABLE IF NOT EXISTS sicas_comisiones_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo de sincronización
  report_code text NOT NULL,
  report_name text,

  -- Estado
  status text NOT NULL DEFAULT 'running',

  -- Estadísticas
  records_fetched int DEFAULT 0,
  records_inserted int DEFAULT 0,
  records_updated int DEFAULT 0,
  records_errors int DEFAULT 0,
  pages_processed int DEFAULT 0,

  -- Fechas
  started_at timestamptz NOT NULL,
  completed_at timestamptz,

  -- Filtros aplicados
  date_from date,
  date_to date,

  -- Error
  error_message text,

  -- Metadata
  metadata jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_sync_log_report_code ON sicas_comisiones_sync_log(report_code);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_sync_log_status ON sicas_comisiones_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sicas_comisiones_sync_log_started_at ON sicas_comisiones_sync_log(started_at DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE sicas_comisiones_pendientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores y SICAS pueden ver todas las comisiones pendientes"
  ON sicas_comisiones_pendientes
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM usuarios
      WHERE rol IN ('admin', 'sicas')
      AND estado = 'activo'
    )
  );

CREATE POLICY "Vendedores pueden ver sus propias comisiones pendientes"
  ON sicas_comisiones_pendientes
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
  );

CREATE POLICY "Service role puede gestionar comisiones pendientes"
  ON sicas_comisiones_pendientes
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

ALTER TABLE sicas_comisiones_pagadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores y SICAS pueden ver todas las comisiones pagadas"
  ON sicas_comisiones_pagadas
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM usuarios
      WHERE rol IN ('admin', 'sicas')
      AND estado = 'activo'
    )
  );

CREATE POLICY "Vendedores pueden ver sus propias comisiones pagadas"
  ON sicas_comisiones_pagadas
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
  );

CREATE POLICY "Service role puede gestionar comisiones pagadas"
  ON sicas_comisiones_pagadas
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

ALTER TABLE sicas_comisiones_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores y SICAS pueden ver el log de sincronización"
  ON sicas_comisiones_sync_log
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM usuarios
      WHERE rol IN ('admin', 'sicas')
      AND estado = 'activo'
    )
  );

CREATE POLICY "Service role puede gestionar el log"
  ON sicas_comisiones_sync_log
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- FUNCIÓN: Aplicar mapeo de vendedores a comisiones
-- =====================================================

CREATE OR REPLACE FUNCTION apply_vendor_mapping_to_commissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sicas_comisiones_pendientes cp
  SET usuario_id = vm.usuario_id,
      updated_at = now()
  FROM vendor_mappings vm
  WHERE cp.vend_id = vm.vendor_id
    AND cp.desp_id = vm.despacho_id
    AND cp.usuario_id IS NULL;

  UPDATE sicas_comisiones_pagadas cpg
  SET usuario_id = vm.usuario_id,
      updated_at = now()
  FROM vendor_mappings vm
  WHERE cpg.vend_id = vm.vendor_id
    AND cpg.desp_id = vm.despacho_id
    AND cpg.usuario_id IS NULL;
END;
$$;

-- =====================================================
-- FUNCIÓN: Obtener resumen de comisiones por usuario
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_commissions_summary(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'pendientes', jsonb_build_object(
      'total', COALESCE(SUM(comision), 0),
      'count', COUNT(*),
      'polizas', COUNT(DISTINCT no_poliza)
    ),
    'pagadas', jsonb_build_object(
      'total', COALESCE(
        (SELECT SUM(comision) FROM sicas_comisiones_pagadas WHERE usuario_id = p_usuario_id),
        0
      ),
      'count', (SELECT COUNT(*) FROM sicas_comisiones_pagadas WHERE usuario_id = p_usuario_id),
      'polizas', (SELECT COUNT(DISTINCT no_poliza) FROM sicas_comisiones_pagadas WHERE usuario_id = p_usuario_id)
    )
  ) INTO v_result
  FROM sicas_comisiones_pendientes
  WHERE usuario_id = p_usuario_id;

  RETURN v_result;
END;
$$;

COMMENT ON TABLE sicas_comisiones_pendientes IS 'Comisiones pendientes de pago desde SICAS (reporte H03492_ALL)';
COMMENT ON TABLE sicas_comisiones_pagadas IS 'Comisiones pagadas desde SICAS (reporte H03797)';
COMMENT ON TABLE sicas_comisiones_sync_log IS 'Historial de sincronizaciones de comisiones SICAS';
