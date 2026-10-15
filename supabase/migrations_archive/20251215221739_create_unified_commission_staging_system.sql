/*
  # Sistema Unificado de Staging para Comisiones

  ## Propósito
  Unificar "Subir Lote" e "Importar Documentos" en un solo flujo.

  ## Nuevas Tablas

  1. commission_staging_sessions
     - Sesión de carga de Excel (reemplaza ambos flujos antiguos)
     - Guarda metadata del parse
     - Estado del procesamiento

  2. commission_items_staging
     - Items temporales antes de crear lotes
     - Incluye matching de usuarios
     - Permite asignación manual
     - Se convierte en commission_items al crear lote

  ## Flujo
  1. Subir Excel -> crear session
  2. Parsear y poblar items_staging
  3. Matching automático de usuarios
  4. Asignar pendientes manualmente
  5. Crear lotes por semana
  6. Items staging -> commission_details

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Solo Admin puede procesar
*/

-- 1. Tabla de sesiones de staging
CREATE TABLE IF NOT EXISTS commission_staging_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadata del archivo
  file_name text NOT NULL,
  file_size bigint,
  sheet_name_used text,
  total_rows_read int DEFAULT 0,
  headers_detected jsonb DEFAULT '[]'::jsonb,
  
  -- Estado del procesamiento
  status text NOT NULL DEFAULT 'uploaded' 
    CHECK (status IN ('uploaded', 'processing', 'parsed', 'ready', 'batches_created', 'error')),
  
  -- Contadores
  total_items int DEFAULT 0,
  recognized_count int DEFAULT 0,
  pending_assignment_count int DEFAULT 0,
  
  -- Agrupaciones
  vendor_groups jsonb DEFAULT '[]'::jsonb,
  
  -- Errores
  parse_errors jsonb DEFAULT '[]'::jsonb,
  
  -- Referencias
  uploaded_by uuid NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  
  -- Lotes creados desde esta sesión
  batches_created uuid[] DEFAULT ARRAY[]::uuid[],
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  batches_created_at timestamptz
);

-- 2. Tabla de items en staging
CREATE TABLE IF NOT EXISTS commission_items_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencia a sesión
  staging_session_id uuid NOT NULL REFERENCES commission_staging_sessions(id) ON DELETE CASCADE,
  
  -- Datos del vendedor (del Excel)
  vendor_email_raw text,
  vendor_email_norm text,
  vendor_name_raw text,
  vendor_name_norm text,
  vendor_key text NOT NULL,
  
  -- Matching con usuario MOVI
  movi_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  match_method text CHECK (match_method IN ('direct_email', 'mapping_email', 'mapping_name', 'manual', 'none')),
  pending_assignment boolean DEFAULT true,
  
  -- Datos de la póliza/comisión
  poliza text NOT NULL,
  ramo text NOT NULL,
  aseguradora text NOT NULL,
  prima_neta float NOT NULL DEFAULT 0,
  porcentaje_base float DEFAULT 0,
  date_fpago date NOT NULL,
  concepto text,
  nombre_asegurado text,
  
  -- Semana calculada (para agrupar en lotes)
  week_number int,
  week_year int,
  week_start_date date,
  week_end_date date,
  
  -- Metadata
  raw_row jsonb DEFAULT '{}'::jsonb,
  
  -- Referencias futuras
  batch_id uuid REFERENCES commission_batches(id) ON DELETE SET NULL,
  commission_detail_id uuid REFERENCES commission_details(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  assigned_at timestamptz,
  converted_at timestamptz
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_staging_sessions_status 
  ON commission_staging_sessions(status);

CREATE INDEX IF NOT EXISTS idx_staging_sessions_uploaded_by 
  ON commission_staging_sessions(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_staging_items_session 
  ON commission_items_staging(staging_session_id);

CREATE INDEX IF NOT EXISTS idx_staging_items_pending 
  ON commission_items_staging(pending_assignment) WHERE pending_assignment = true;

CREATE INDEX IF NOT EXISTS idx_staging_items_vendor_key 
  ON commission_items_staging(vendor_key);

CREATE INDEX IF NOT EXISTS idx_staging_items_user 
  ON commission_items_staging(movi_user_id) WHERE movi_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staging_items_week 
  ON commission_items_staging(week_year, week_number);

CREATE INDEX IF NOT EXISTS idx_staging_items_batch 
  ON commission_items_staging(batch_id) WHERE batch_id IS NOT NULL;

-- 4. Triggers para updated_at
CREATE OR REPLACE FUNCTION update_staging_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staging_session_updated_at ON commission_staging_sessions;
CREATE TRIGGER staging_session_updated_at
  BEFORE UPDATE ON commission_staging_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_staging_session_updated_at();

CREATE OR REPLACE FUNCTION update_staging_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staging_item_updated_at ON commission_items_staging;
CREATE TRIGGER staging_item_updated_at
  BEFORE UPDATE ON commission_items_staging
  FOR EACH ROW
  EXECUTE FUNCTION update_staging_item_updated_at();

-- 5. Función para recalcular contadores de sesión
CREATE OR REPLACE FUNCTION recalculate_staging_session_counters(session_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE commission_staging_sessions
  SET
    total_items = (
      SELECT COUNT(*) 
      FROM commission_items_staging 
      WHERE staging_session_id = session_id
    ),
    recognized_count = (
      SELECT COUNT(*) 
      FROM commission_items_staging 
      WHERE staging_session_id = session_id 
        AND movi_user_id IS NOT NULL
    ),
    pending_assignment_count = (
      SELECT COUNT(*) 
      FROM commission_items_staging 
      WHERE staging_session_id = session_id 
        AND pending_assignment = true
    ),
    updated_at = now()
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Enable RLS
ALTER TABLE commission_staging_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_items_staging ENABLE ROW LEVEL SECURITY;

-- RLS Policies para commission_staging_sessions
CREATE POLICY "Admins pueden ver todas las sesiones"
  ON commission_staging_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden insertar sesiones"
  ON commission_staging_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden actualizar sesiones"
  ON commission_staging_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden eliminar sesiones"
  ON commission_staging_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- RLS Policies para commission_items_staging
CREATE POLICY "Admins pueden ver todos los items staging"
  ON commission_items_staging FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden insertar items staging"
  ON commission_items_staging FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden actualizar items staging"
  ON commission_items_staging FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden eliminar items staging"
  ON commission_items_staging FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- 7. Agregar columna pending_assignment a commission_details si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'pending_assignment'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN pending_assignment boolean DEFAULT false;
    CREATE INDEX idx_commission_details_pending ON commission_details(pending_assignment) WHERE pending_assignment = true;
  END IF;
END $$;

-- 8. Agregar constraint para prevenir cierre de lote con pendientes
CREATE OR REPLACE FUNCTION prevent_batch_close_with_pending()
RETURNS TRIGGER AS $$
DECLARE
  pending_count int;
BEGIN
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    SELECT COUNT(*) INTO pending_count
    FROM commission_details
    WHERE batch_id = NEW.id
      AND pending_assignment = true;
    
    IF pending_count > 0 THEN
      RAISE EXCEPTION 'No puedes cerrar el lote: existen % documentos sin usuario asignado. Asigna los pendientes para continuar.', pending_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_close_with_pending ON commission_batches;
CREATE TRIGGER prevent_close_with_pending
  BEFORE UPDATE ON commission_batches
  FOR EACH ROW
  EXECUTE FUNCTION prevent_batch_close_with_pending();
