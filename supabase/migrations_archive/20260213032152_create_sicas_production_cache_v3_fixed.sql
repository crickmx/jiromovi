/*
  # Sistema de Caché de Producción SICAS v3

  Este módulo crea las tablas necesarias para cachear datos de producción SICAS.
  
  CORRECCIÓN: Usa TEXT para id_sicas (no INTEGER) para coincidir con sicas_catalogos.

  ## Tablas Principales

  1. **sicas_polizas_vigentes** - Caché de pólizas vigentes
  2. **sicas_cobranza_pendiente** - Caché de cobranza pendiente
  3. **sicas_production_sync_log** - Historial de sincronizaciones

  ## Permisos RLS
     - Agentes: solo su vendedor
     - Gerentes: su oficina
     - Admin: todo
*/

-- Tabla: sicas_polizas_vigentes
CREATE TABLE IF NOT EXISTS sicas_polizas_vigentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificadores SICAS (TEXT para coincidir con sicas_catalogos)
  id_documento TEXT NOT NULL,
  no_poliza TEXT,
  
  -- Vendedor (TEXT como en sicas_catalogos.id_sicas)
  vend_id TEXT NOT NULL,
  vend_nombre TEXT,
  
  -- Despacho/Oficina (TEXT)
  desp_id TEXT,
  desp_nombre TEXT,
  
  -- Datos de la póliza
  aseguradora TEXT,
  ramo TEXT,
  subramo TEXT,
  contratante TEXT,
  asegurado TEXT,
  
  -- Vigencias
  vigencia_desde DATE,
  vigencia_hasta DATE,
  
  -- Importes
  prima_neta DECIMAL(15,2),
  prima_total DECIMAL(15,2),
  
  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_poliza_documento UNIQUE (id_documento)
);

CREATE INDEX IF NOT EXISTS idx_polizas_vend_id ON sicas_polizas_vigentes(vend_id);
CREATE INDEX IF NOT EXISTS idx_polizas_vigencia_hasta ON sicas_polizas_vigentes(vigencia_hasta);
CREATE INDEX IF NOT EXISTS idx_polizas_aseguradora ON sicas_polizas_vigentes(aseguradora);
CREATE INDEX IF NOT EXISTS idx_polizas_ramo ON sicas_polizas_vigentes(ramo);
CREATE INDEX IF NOT EXISTS idx_polizas_desp_id ON sicas_polizas_vigentes(desp_id);

-- Tabla: sicas_cobranza_pendiente
CREATE TABLE IF NOT EXISTS sicas_cobranza_pendiente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  vend_id TEXT NOT NULL,
  vend_nombre TEXT,
  
  cliente TEXT,
  no_poliza TEXT,
  id_documento TEXT,
  
  importe_pendiente DECIMAL(15,2),
  fecha_limite DATE,
  dias_vencidos INTEGER,
  
  status TEXT,
  
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobranza_vend_id ON sicas_cobranza_pendiente(vend_id);
CREATE INDEX IF NOT EXISTS idx_cobranza_fecha_limite ON sicas_cobranza_pendiente(fecha_limite);

-- Tabla: sicas_production_sync_log
CREATE TABLE IF NOT EXISTS sicas_production_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_errors INTEGER DEFAULT 0,
  
  error_message TEXT,
  metadata JSONB,
  
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  
  initiated_by UUID REFERENCES usuarios(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_sync_type ON sicas_production_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_prod_sync_started ON sicas_production_sync_log(started_at DESC);

-- Vista: sicas_renovaciones_proximas
CREATE OR REPLACE VIEW sicas_renovaciones_proximas AS
SELECT 
  id,
  id_documento,
  no_poliza,
  vend_id,
  vend_nombre,
  desp_id,
  desp_nombre,
  aseguradora,
  ramo,
  subramo,
  contratante,
  asegurado,
  vigencia_desde,
  vigencia_hasta,
  prima_neta,
  prima_total,
  (vigencia_hasta - CURRENT_DATE) as dias_para_vencer,
  CASE 
    WHEN (vigencia_hasta - CURRENT_DATE) <= 7 THEN 'critico'
    WHEN (vigencia_hasta - CURRENT_DATE) <= 15 THEN 'urgente'
    WHEN (vigencia_hasta - CURRENT_DATE) <= 30 THEN 'proximo'
    WHEN (vigencia_hasta - CURRENT_DATE) <= 60 THEN 'planificar'
    ELSE 'normal'
  END as prioridad_renovacion
FROM sicas_polizas_vigentes
WHERE vigencia_hasta >= CURRENT_DATE
  AND vigencia_hasta <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY vigencia_hasta ASC;

-- Vista: sicas_emitidas_mes_actual
CREATE OR REPLACE VIEW sicas_emitidas_mes_actual AS
SELECT 
  id,
  id_documento,
  no_poliza,
  vend_id,
  vend_nombre,
  desp_id,
  desp_nombre,
  aseguradora,
  ramo,
  subramo,
  contratante,
  asegurado,
  vigencia_desde,
  vigencia_hasta,
  prima_neta,
  prima_total,
  synced_at
FROM sicas_polizas_vigentes
WHERE EXTRACT(YEAR FROM vigencia_desde) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM vigencia_desde) = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY vigencia_desde DESC;

-- Enable RLS
ALTER TABLE sicas_polizas_vigentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sicas_cobranza_pendiente ENABLE ROW LEVEL SECURITY;
ALTER TABLE sicas_production_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS: sicas_polizas_vigentes

CREATE POLICY "Admin ve todas las polizas"
  ON sicas_polizas_vigentes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'admin'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Gerente ve polizas de su oficina"
  ON sicas_polizas_vigentes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'gerente'
        AND u.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM sicas_mapeo_despacho_oficina mdo
          WHERE mdo.id_sicas_despacho::TEXT = sicas_polizas_vigentes.desp_id
            AND mdo.movi_oficina_id = u.oficina_id
        )
    )
  );

CREATE POLICY "Agente ve solo sus polizas"
  ON sicas_polizas_vigentes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN sicas_mapeo_vendedor_usuario mvu ON mvu.movi_user_id = u.id
      WHERE u.id = auth.uid()
        AND u.deleted_at IS NULL
        AND mvu.id_sicas_vendedor::TEXT = sicas_polizas_vigentes.vend_id
    )
  );

CREATE POLICY "Service role gestiona polizas"
  ON sicas_polizas_vigentes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- RLS: sicas_cobranza_pendiente

CREATE POLICY "Admin ve toda cobranza"
  ON sicas_cobranza_pendiente FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'admin'
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Gerente ve cobranza de su oficina"
  ON sicas_cobranza_pendiente FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'gerente'
        AND u.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM sicas_mapeo_vendedor_usuario mvu
          JOIN usuarios u2 ON u2.id = mvu.movi_user_id
          WHERE mvu.id_sicas_vendedor::TEXT = sicas_cobranza_pendiente.vend_id
            AND u2.oficina_id = u.oficina_id
            AND u2.deleted_at IS NULL
        )
    )
  );

CREATE POLICY "Agente ve solo su cobranza"
  ON sicas_cobranza_pendiente FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN sicas_mapeo_vendedor_usuario mvu ON mvu.movi_user_id = u.id
      WHERE u.id = auth.uid()
        AND u.deleted_at IS NULL
        AND mvu.id_sicas_vendedor::TEXT = sicas_cobranza_pendiente.vend_id
    )
  );

CREATE POLICY "Service role gestiona cobranza"
  ON sicas_cobranza_pendiente FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- RLS: sicas_production_sync_log

CREATE POLICY "Admin y gerentes ven log"
  ON sicas_production_sync_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('admin', 'gerente')
        AND usuarios.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role gestiona log"
  ON sicas_production_sync_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Función: get_my_sicas_vendor
CREATE OR REPLACE FUNCTION get_my_sicas_vendor()
RETURNS TABLE (
  vend_id TEXT,
  vend_nombre TEXT,
  mapped_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mvu.id_sicas_vendedor::TEXT,
    sc.nombre,
    mvu.mapped_at
  FROM sicas_mapeo_vendedor_usuario mvu
  JOIN sicas_catalogos sc ON sc.id_sicas = mvu.id_sicas_vendedor::TEXT
    AND sc.catalog_type_id = 32
  WHERE mvu.movi_user_id = auth.uid();
END;
$$;

-- Función: check_user_sicas_mapping
CREATE OR REPLACE FUNCTION check_user_sicas_mapping()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM sicas_mapeo_vendedor_usuario
    WHERE movi_user_id = auth.uid()
  );
END;
$$;