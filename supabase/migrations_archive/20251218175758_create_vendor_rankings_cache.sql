/*
  # Crear cache de rankings de vendedores

  1. Nueva tabla
    - `vendor_rankings_cache`
      - `movi_user_id` (uuid, primary key, FK a usuarios)
      - `vendor_nombre` (text) - Nombre del vendedor
      - `posicion_nacional` (integer) - Posición a nivel nacional
      - `total_vendedores_nacional` (integer) - Total de vendedores nacional
      - `posicion_oficina` (integer, nullable) - Posición en oficina
      - `total_vendedores_oficina` (integer) - Total de vendedores en oficina
      - `nombre_oficina` (text, nullable) - Nombre de la oficina
      - `produccion_anual` (numeric) - Producción acumulada del año
      - `num_documentos` (integer) - Número de documentos
      - `calculated_at` (timestamptz) - Cuándo se calculó
      - `year` (integer) - Año de referencia

  2. Seguridad
    - Habilitar RLS
    - Solo usuarios autenticados pueden ver su propio ranking
*/

-- Crear tabla de cache
CREATE TABLE IF NOT EXISTS vendor_rankings_cache (
  movi_user_id uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  vendor_nombre text NOT NULL,
  posicion_nacional integer,
  total_vendedores_nacional integer NOT NULL DEFAULT 0,
  posicion_oficina integer,
  total_vendedores_oficina integer NOT NULL DEFAULT 0,
  nombre_oficina text,
  produccion_anual numeric NOT NULL DEFAULT 0,
  num_documentos integer NOT NULL DEFAULT 0,
  calculated_at timestamptz DEFAULT NOW(),
  year integer NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_vendor_rankings_cache_year ON vendor_rankings_cache(year);
CREATE INDEX IF NOT EXISTS idx_vendor_rankings_cache_calculated_at ON vendor_rankings_cache(calculated_at);

-- Habilitar RLS
ALTER TABLE vendor_rankings_cache ENABLE ROW LEVEL SECURITY;

-- Políticas: Los usuarios solo pueden ver su propio ranking
CREATE POLICY "Users can view own ranking cache"
  ON vendor_rankings_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = movi_user_id);

-- Política para service_role (Edge Functions)
CREATE POLICY "Service role can manage ranking cache"
  ON vendor_rankings_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Función para actualizar el timestamp
CREATE OR REPLACE FUNCTION update_vendor_rankings_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp automáticamente
DROP TRIGGER IF EXISTS update_vendor_rankings_cache_timestamp_trigger ON vendor_rankings_cache;
CREATE TRIGGER update_vendor_rankings_cache_timestamp_trigger
  BEFORE UPDATE ON vendor_rankings_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_rankings_cache_timestamp();
