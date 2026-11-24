/*
  # Sistema de Batches para Producción

  1. Nueva tabla production_import_batches
    - Tracking de sincronizaciones desde Google Sheets
    - Estado: running | success | partial | failed
    - Metadata de sync (rows, errores, timestamps)
    
  2. Optimización de production_records
    - Agregar batch_id para tracking
    - Agregar índices críticos para performance
    - Agregar campos de control
    
  3. Índices de performance
    - user lookups
    - date range queries
    - batch filtering
    
  4. Seguridad
    - RLS en production_import_batches
*/

-- Crear tabla de batches de importación
CREATE TABLE IF NOT EXISTS production_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL DEFAULT 'google_sheets',
  source_identifier text,
  sheet_id text,
  sheet_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  rows_total integer DEFAULT 0,
  rows_inserted integer DEFAULT 0,
  rows_failed integer DEFAULT 0,
  last_error text,
  error_details jsonb,
  visible_to_agents boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Agregar batch_id a production_records si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'production_records' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE production_records ADD COLUMN batch_id uuid REFERENCES production_import_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Agregar pending_assignment flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'production_records' AND column_name = 'pending_assignment'
  ) THEN
    ALTER TABLE production_records ADD COLUMN pending_assignment boolean DEFAULT false;
  END IF;
END $$;

-- Índices críticos para performance
CREATE INDEX IF NOT EXISTS idx_production_records_batch_id ON production_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_production_records_agente_fecha ON production_records(agente_nombre, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_production_records_fecha ON production_records(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_production_records_aseguradora ON production_records(aseguradora_nombre);
CREATE INDEX IF NOT EXISTS idx_production_records_ramo ON production_records(ramo_nombre);

-- Índices para batches
CREATE INDEX IF NOT EXISTS idx_batches_status ON production_import_batches(status, visible_to_agents, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON production_import_batches(created_at DESC);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_production_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS production_batches_updated_at ON production_import_batches;
CREATE TRIGGER production_batches_updated_at
  BEFORE UPDATE ON production_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_production_batches_updated_at();

-- RLS para production_import_batches
ALTER TABLE production_import_batches ENABLE ROW LEVEL SECURITY;

-- Admin puede ver todos los batches
CREATE POLICY "Admin can view all batches"
  ON production_import_batches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND usuarios.rol = 'admin'
    )
  );

-- Gerentes pueden ver batches
CREATE POLICY "Gerentes can view batches"
  ON production_import_batches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND usuarios.rol = 'gerente'
    )
  );

-- Agentes pueden ver batches visibles
CREATE POLICY "Agentes can view visible batches"
  ON production_import_batches
  FOR SELECT
  TO authenticated
  USING (
    visible_to_agents = true
    AND EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND usuarios.rol IN ('agente', 'gerente', 'admin')
    )
  );

-- Admin puede insertar/actualizar batches
CREATE POLICY "Admin can insert batches"
  ON production_import_batches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admin can update batches"
  ON production_import_batches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND usuarios.rol = 'admin'
    )
  );

-- Service role puede gestionar todo (para Edge Functions)
CREATE POLICY "Service role full access batches"
  ON production_import_batches
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Función helper para obtener último batch exitoso
CREATE OR REPLACE FUNCTION get_latest_successful_batch()
RETURNS uuid AS $$
  SELECT id 
  FROM production_import_batches
  WHERE status = 'success' 
    AND visible_to_agents = true
  ORDER BY finished_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Comentarios para documentación
COMMENT ON TABLE production_import_batches IS 'Tracking de sincronizaciones de producción desde Google Sheets';
COMMENT ON COLUMN production_import_batches.status IS 'Estado del batch: running, success, partial, failed';
COMMENT ON COLUMN production_import_batches.visible_to_agents IS 'Si es visible para agentes en Mi Producción';
COMMENT ON FUNCTION get_latest_successful_batch IS 'Retorna el ID del último batch exitoso y visible';
