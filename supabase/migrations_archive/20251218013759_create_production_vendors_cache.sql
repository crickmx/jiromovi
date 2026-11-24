/*
  # Cache de Vendedores de Producción

  ## Problema
  La carga de vendedores desde Google Sheets es excesivamente lenta porque:
  1. Se llama a Google Sheets en cada carga de página
  2. Se hacen múltiples queries individuales para buscar mapeos

  ## Solución
  Crear una tabla de cache que almacene los vendedores únicos con sus mapeos pre-calculados.

  ## Cambios
  1. Nueva tabla `production_vendors_cache`
  2. Trigger automático para actualizar cache cuando cambian los mapeos
  3. Índices para búsqueda rápida
*/

-- =============================================
-- TABLA DE CACHE DE VENDEDORES
-- =============================================
CREATE TABLE IF NOT EXISTS production_vendors_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación del vendedor
  vendor_nombre text NOT NULL,
  vendor_nombre_normalized text NOT NULL,

  -- Mapeo resuelto (pre-calculado)
  movi_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  movi_user_name text,
  oficina_nombre text,
  mapping_source text CHECK (mapping_source IN ('auto', 'manual', 'none')),
  match_method text CHECK (match_method IN ('direct_name', 'mapping_name', 'none')),

  -- Estadísticas
  total_records integer DEFAULT 0,

  -- Auditoría
  synced_from_sheets_at timestamptz,
  mapping_updated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_vendors_cache_nombre
  ON production_vendors_cache(vendor_nombre);

CREATE INDEX IF NOT EXISTS idx_production_vendors_cache_normalized
  ON production_vendors_cache(vendor_nombre_normalized);

CREATE INDEX IF NOT EXISTS idx_production_vendors_cache_user
  ON production_vendors_cache(movi_user_id);

CREATE INDEX IF NOT EXISTS idx_production_vendors_cache_mapping_source
  ON production_vendors_cache(mapping_source);

-- =============================================
-- FUNCIÓN: Refrescar mapeo de un vendedor en cache
-- =============================================
CREATE OR REPLACE FUNCTION refresh_vendor_mapping_cache(p_vendor_nombre text)
RETURNS void AS $$
DECLARE
  v_normalized text;
  v_mapping_id uuid;
  v_user_id uuid;
  v_user_name text;
  v_oficina_nombre text;
  v_match_method text;
  v_mapping_source text;
BEGIN
  -- Normalizar nombre
  v_normalized := normalize_vendor_name(p_vendor_nombre);

  IF v_normalized IS NULL THEN
    RETURN;
  END IF;

  -- Buscar en vendor_mappings
  SELECT vm.movi_user_id, u.nombre_completo, o.nombre
  INTO v_user_id, v_user_name, v_oficina_nombre
  FROM vendor_mappings vm
  LEFT JOIN usuarios u ON u.id = vm.movi_user_id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE vm.source_type = 'name'
    AND vm.source_value = v_normalized
    AND vm.status = 'active'
  LIMIT 1;

  IF FOUND THEN
    v_match_method := 'mapping_name';
    v_mapping_source := 'manual';
  ELSE
    -- Buscar coincidencia directa en usuarios
    SELECT u.id, u.nombre_completo, o.nombre
    INTO v_user_id, v_user_name, v_oficina_nombre
    FROM usuarios u
    LEFT JOIN oficinas o ON o.id = u.oficina_id
    WHERE normalize_vendor_name(u.nombre_completo) = v_normalized
      AND u.estado != 'eliminado'
    LIMIT 1;

    IF FOUND THEN
      v_match_method := 'direct_name';
      v_mapping_source := 'auto';
    ELSE
      v_user_id := NULL;
      v_user_name := NULL;
      v_oficina_nombre := NULL;
      v_match_method := 'none';
      v_mapping_source := 'none';
    END IF;
  END IF;

  -- Actualizar o insertar en cache
  INSERT INTO production_vendors_cache (
    vendor_nombre,
    vendor_nombre_normalized,
    movi_user_id,
    movi_user_name,
    oficina_nombre,
    mapping_source,
    match_method,
    mapping_updated_at
  ) VALUES (
    p_vendor_nombre,
    v_normalized,
    v_user_id,
    v_user_name,
    v_oficina_nombre,
    v_mapping_source,
    v_match_method,
    now()
  )
  ON CONFLICT (vendor_nombre)
  DO UPDATE SET
    vendor_nombre_normalized = EXCLUDED.vendor_nombre_normalized,
    movi_user_id = EXCLUDED.movi_user_id,
    movi_user_name = EXCLUDED.movi_user_name,
    oficina_nombre = EXCLUDED.oficina_nombre,
    mapping_source = EXCLUDED.mapping_source,
    match_method = EXCLUDED.match_method,
    mapping_updated_at = EXCLUDED.mapping_updated_at,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGER: Actualizar cache cuando cambia un mapeo
-- =============================================
CREATE OR REPLACE FUNCTION trigger_refresh_vendor_cache()
RETURNS TRIGGER AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Cuando se crea o actualiza un mapping de tipo 'name', refrescar todos los vendedores que coincidan
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.source_type = 'name' THEN
    FOR v_rec IN
      SELECT DISTINCT vendor_nombre
      FROM production_vendors_cache
      WHERE vendor_nombre_normalized = NEW.source_value
    LOOP
      PERFORM refresh_vendor_mapping_cache(v_rec.vendor_nombre);
    END LOOP;
  END IF;

  -- Cuando se elimina un mapping, refrescar los vendedores afectados
  IF TG_OP = 'DELETE' AND OLD.source_type = 'name' THEN
    FOR v_rec IN
      SELECT DISTINCT vendor_nombre
      FROM production_vendors_cache
      WHERE vendor_nombre_normalized = OLD.source_value
    LOOP
      PERFORM refresh_vendor_mapping_cache(v_rec.vendor_nombre);
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_refresh_vendor_cache_on_mapping_change ON vendor_mappings;
CREATE TRIGGER trigger_refresh_vendor_cache_on_mapping_change
  AFTER INSERT OR UPDATE OR DELETE ON vendor_mappings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_vendor_cache();

-- =============================================
-- FUNCIÓN: normalize_vendor_name (si no existe)
-- =============================================
CREATE OR REPLACE FUNCTION normalize_vendor_name(name_input text)
RETURNS text AS $$
DECLARE
  normalized text;
BEGIN
  IF name_input IS NULL OR trim(name_input) = '' THEN
    RETURN NULL;
  END IF;

  normalized := lower(trim(name_input));

  -- Remover acentos
  normalized := translate(normalized,
    'áéíóúüñàèìòùäëïöü',
    'aeiouunaeiouaeiou');

  -- Normalizar espacios
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE production_vendors_cache ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer el cache
CREATE POLICY "Authenticated users can view production vendors cache"
  ON production_vendors_cache FOR SELECT
  TO authenticated
  USING (true);

-- Solo service_role puede modificar (a través de edge functions)
CREATE POLICY "Service role can manage production vendors cache"
  ON production_vendors_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- COMENTARIOS
-- =============================================
COMMENT ON TABLE production_vendors_cache IS 'Cache de vendedores únicos de producción con mapeos pre-calculados. Sincronizado desde Google Sheets.';
COMMENT ON FUNCTION refresh_vendor_mapping_cache IS 'Actualiza el mapeo de un vendedor en el cache basándose en vendor_mappings y usuarios.';
COMMENT ON FUNCTION normalize_vendor_name IS 'Normaliza un nombre de vendedor (lowercase, sin acentos, espacios normalizados).';
