/*
  # Crear módulo de Producción

  1. Nuevas Tablas
    - `production_offices` - Catálogo de oficinas
      - `id` (uuid, primary key)
      - `code` (text, opcional)
      - `name` (text, nombre estandarizado)
      - `original_names` (jsonb, variaciones del Excel)
      - `region_id` (uuid, FK opcional)
      - `created_at`, `updated_at`
    
    - `production_managements` - Catálogo de gerencias
      - `id` (uuid, primary key)
      - `name` (text)
      - `original_names` (jsonb)
      - `created_at`, `updated_at`
    
    - `production_regions` - Catálogo de regiones
      - `id` (uuid, primary key)
      - `name` (text)
      - `original_names` (jsonb)
      - `created_at`, `updated_at`
    
    - `production_records` - Registros de producción
      - `id` (uuid, primary key)
      - `fecha` (date)
      - `anio` (int)
      - `mes` (int)
      - `dia` (int)
      - `periodo_mes` (text, formato YYYY-MM)
      - `periodo_anio` (int)
      - `office_id` (uuid, FK)
      - `management_id` (uuid, FK)
      - `region_id` (uuid, FK nullable)
      - `desp_nombre_raw` (text)
      - `gerencia_nombre_raw` (text)
      - `region_raw` (text)
      - `agente_nombre` (text)
      - `aseguradora_nombre` (text)
      - `ramo_nombre` (text)
      - `subramo_nombre` (text)
      - `importe_pesos` (numeric)
      - `prima_convenio` (numeric)
      - `prima_ponderada` (numeric)
      - `bono` (numeric)
      - `convenio_flag` (boolean)
      - `porcentaje_bono` (numeric nullable)
      - `created_at`, `updated_at`
    
    - `production_import_logs` - Log de importaciones
      - `id` (uuid, primary key)
      - `imported_at` (timestamptz)
      - `imported_by_user_id` (uuid, FK)
      - `file_name` (text)
      - `records_count` (int)
      - `created_at`
  
  2. Modificaciones a usuarios
    - Agregar `production_office_id` (uuid, FK a production_offices)
  
  3. Seguridad
    - Enable RLS en todas las tablas
    - Políticas para Admin (acceso total)
    - Políticas para Gerente (solo su oficina)
*/

-- Crear tabla de regiones
CREATE TABLE IF NOT EXISTS production_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  original_names jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de oficinas
CREATE TABLE IF NOT EXISTS production_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  name text NOT NULL,
  original_names jsonb DEFAULT '[]'::jsonb,
  region_id uuid REFERENCES production_regions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de gerencias
CREATE TABLE IF NOT EXISTS production_managements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  original_names jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de registros de producción
CREATE TABLE IF NOT EXISTS production_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  anio int NOT NULL,
  mes int NOT NULL,
  dia int NOT NULL,
  periodo_mes text NOT NULL,
  periodo_anio int NOT NULL,
  office_id uuid REFERENCES production_offices(id) ON DELETE CASCADE,
  management_id uuid REFERENCES production_managements(id) ON DELETE CASCADE,
  region_id uuid REFERENCES production_regions(id) ON DELETE SET NULL,
  desp_nombre_raw text NOT NULL,
  gerencia_nombre_raw text NOT NULL,
  region_raw text,
  agente_nombre text NOT NULL,
  aseguradora_nombre text NOT NULL,
  ramo_nombre text NOT NULL,
  subramo_nombre text,
  importe_pesos numeric DEFAULT 0,
  prima_convenio numeric DEFAULT 0,
  prima_ponderada numeric DEFAULT 0,
  bono numeric DEFAULT 0,
  convenio_flag boolean DEFAULT false,
  porcentaje_bono numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_production_records_fecha ON production_records(fecha);
CREATE INDEX IF NOT EXISTS idx_production_records_office ON production_records(office_id);
CREATE INDEX IF NOT EXISTS idx_production_records_management ON production_records(management_id);
CREATE INDEX IF NOT EXISTS idx_production_records_region ON production_records(region_id);
CREATE INDEX IF NOT EXISTS idx_production_records_periodo_mes ON production_records(periodo_mes);
CREATE INDEX IF NOT EXISTS idx_production_records_convenio ON production_records(convenio_flag);

-- Crear tabla de logs de importación
CREATE TABLE IF NOT EXISTS production_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at timestamptz DEFAULT now(),
  imported_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  records_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Agregar columna production_office_id a usuarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'production_office_id'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN production_office_id uuid REFERENCES production_offices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE production_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_managements ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_import_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para production_regions
CREATE POLICY "Admins can view all regions"
  ON production_regions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert regions"
  ON production_regions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update regions"
  ON production_regions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para production_offices
CREATE POLICY "Admins can view all offices"
  ON production_offices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Gerentes can view their office"
  ON production_offices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.production_office_id = production_offices.id
    )
  );

CREATE POLICY "Admins can insert offices"
  ON production_offices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update offices"
  ON production_offices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para production_managements
CREATE POLICY "Authenticated users can view managements"
  ON production_managements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert managements"
  ON production_managements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update managements"
  ON production_managements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para production_records
CREATE POLICY "Admins can view all production records"
  ON production_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Gerentes can view their office production"
  ON production_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Gerente'
      AND usuarios.production_office_id = production_records.office_id
    )
  );

CREATE POLICY "Admins can delete production records"
  ON production_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can insert production records"
  ON production_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para production_import_logs
CREATE POLICY "Authenticated users can view import logs"
  ON production_import_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert import logs"
  ON production_import_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_production_regions_updated_at ON production_regions;
CREATE TRIGGER update_production_regions_updated_at
  BEFORE UPDATE ON production_regions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_production_offices_updated_at ON production_offices;
CREATE TRIGGER update_production_offices_updated_at
  BEFORE UPDATE ON production_offices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_production_managements_updated_at ON production_managements;
CREATE TRIGGER update_production_managements_updated_at
  BEFORE UPDATE ON production_managements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_production_records_updated_at ON production_records;
CREATE TRIGGER update_production_records_updated_at
  BEFORE UPDATE ON production_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
