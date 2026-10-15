/*
  # Sistema de Cache para Producción por Vendedor

  1. Nuevas Tablas
    - `production_vendor_cache`: Cache de datos agregados por vendedor
    - `production_cache_metadata`: Metadata de cache (última actualización, TTL)
    - `production_vendor_details_cache`: Cache de detalles por vendedor (lazy loading)

  2. Índices
    - Índices optimizados para búsqueda y paginación

  3. Security
    - RLS habilitado en todas las tablas
    - Solo autenticados pueden leer
    - Solo admins pueden refrescar cache

  4. Funciones
    - Función para invalidar cache
    - Función para verificar si cache es válido
*/

-- ============================================
-- TABLA: production_cache_metadata
-- ============================================

CREATE TABLE IF NOT EXISTS production_cache_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  last_fetched_at timestamptz NOT NULL DEFAULT NOW(),
  last_fetch_duration_ms INTEGER,
  total_records INTEGER DEFAULT 0,
  total_vendors INTEGER DEFAULT 0,
  ttl_minutes INTEGER DEFAULT 10,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_production_cache_metadata_key ON production_cache_metadata(cache_key);
CREATE INDEX IF NOT EXISTS idx_production_cache_metadata_fetched_at ON production_cache_metadata(last_fetched_at DESC);

-- RLS
ALTER TABLE production_cache_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cache metadata"
  ON production_cache_metadata
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage cache metadata"
  ON production_cache_metadata
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- ============================================
-- TABLA: production_vendor_cache
-- ============================================

CREATE TABLE IF NOT EXISTS production_vendor_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  vend_nombre TEXT NOT NULL,
  vend_nombre_normalized TEXT,
  movi_user_id uuid,
  movi_user_name TEXT,
  oficina_nombre TEXT,
  match_method TEXT CHECK (match_method IN ('direct_name', 'mapping_name', 'none')),
  total_records INTEGER DEFAULT 0,
  total_importe_pesos NUMERIC(15,2) DEFAULT 0,
  total_prima_convenio NUMERIC(15,2) DEFAULT 0,
  total_prima_ponderada NUMERIC(15,2) DEFAULT 0,
  total_bono NUMERIC(15,2) DEFAULT 0,
  earliest_date DATE,
  latest_date DATE,
  unique_ramos TEXT[],
  unique_aseguradoras TEXT[],
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(cache_key, vend_nombre)
);

-- Índices para búsqueda y paginación
CREATE INDEX IF NOT EXISTS idx_production_vendor_cache_key ON production_vendor_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_production_vendor_cache_vend_nombre ON production_vendor_cache(vend_nombre);
CREATE INDEX IF NOT EXISTS idx_production_vendor_cache_normalized ON production_vendor_cache(vend_nombre_normalized);
CREATE INDEX IF NOT EXISTS idx_production_vendor_cache_user_id ON production_vendor_cache(movi_user_id);
CREATE INDEX IF NOT EXISTS idx_production_vendor_cache_match_method ON production_vendor_cache(match_method);
CREATE INDEX IF NOT EXISTS idx_production_vendor_cache_total_importe ON production_vendor_cache(total_importe_pesos DESC);
CREATE INDEX IF NOT EXISTS idx_production_vendor_cache_total_convenio ON production_vendor_cache(total_prima_convenio DESC);

-- RLS
ALTER TABLE production_vendor_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vendor cache"
  ON production_vendor_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage vendor cache"
  ON production_vendor_cache
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- ============================================
-- TABLA: production_vendor_details_cache
-- ============================================

CREATE TABLE IF NOT EXISTS production_vendor_details_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  vend_nombre TEXT NOT NULL,
  details_json JSONB NOT NULL,
  record_count INTEGER DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(cache_key, vend_nombre)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_production_vendor_details_cache_key ON production_vendor_details_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_production_vendor_details_cache_vend_nombre ON production_vendor_details_cache(vend_nombre);

-- RLS
ALTER TABLE production_vendor_details_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vendor details cache"
  ON production_vendor_details_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage vendor details cache"
  ON production_vendor_details_cache
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- ============================================
-- FUNCIÓN: invalidar cache
-- ============================================

CREATE OR REPLACE FUNCTION invalidate_production_cache(p_cache_key TEXT DEFAULT 'production_vendors_main')
RETURNS BOOLEAN AS $$
BEGIN
  -- Eliminar cache de vendedores
  DELETE FROM production_vendor_cache WHERE cache_key = p_cache_key;
  
  -- Eliminar cache de detalles
  DELETE FROM production_vendor_details_cache WHERE cache_key = p_cache_key;
  
  -- Eliminar metadata
  DELETE FROM production_cache_metadata WHERE cache_key = p_cache_key;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN: verificar validez de cache
-- ============================================

CREATE OR REPLACE FUNCTION is_production_cache_valid(p_cache_key TEXT DEFAULT 'production_vendors_main')
RETURNS BOOLEAN AS $$
DECLARE
  v_last_fetched timestamptz;
  v_ttl_minutes INTEGER;
  v_is_valid BOOLEAN;
BEGIN
  SELECT last_fetched_at, ttl_minutes
  INTO v_last_fetched, v_ttl_minutes
  FROM production_cache_metadata
  WHERE cache_key = p_cache_key;
  
  IF v_last_fetched IS NULL THEN
    RETURN FALSE;
  END IF;
  
  v_is_valid := (v_last_fetched + (v_ttl_minutes * INTERVAL '1 minute')) > NOW();
  
  RETURN v_is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN: obtener metadata de cache
-- ============================================

CREATE OR REPLACE FUNCTION get_production_cache_metadata(p_cache_key TEXT DEFAULT 'production_vendors_main')
RETURNS TABLE(
  last_fetched_at timestamptz,
  last_fetch_duration_ms INTEGER,
  total_records INTEGER,
  total_vendors INTEGER,
  ttl_minutes INTEGER,
  is_valid BOOLEAN,
  minutes_until_expiry NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pcm.last_fetched_at,
    pcm.last_fetch_duration_ms,
    pcm.total_records,
    pcm.total_vendors,
    pcm.ttl_minutes,
    is_production_cache_valid(p_cache_key) as is_valid,
    CASE
      WHEN is_production_cache_valid(p_cache_key) THEN
        EXTRACT(EPOCH FROM (pcm.last_fetched_at + (pcm.ttl_minutes * INTERVAL '1 minute') - NOW())) / 60
      ELSE
        0
    END as minutes_until_expiry
  FROM production_cache_metadata pcm
  WHERE pcm.cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER: actualizar updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_production_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_production_cache_metadata_updated_at ON production_cache_metadata;

CREATE TRIGGER trigger_update_production_cache_metadata_updated_at
  BEFORE UPDATE ON production_cache_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_production_cache_updated_at();
