/*
  # Tabla de auditoría para conversiones de lotes

  1. Nueva tabla
    - `conversion_jobs` - Registro completo de cada conversión
      - tracking de inicio/fin, estados, errores
      - report completo con items insertados
      - permite diagnóstico de fallos

  2. Seguridad
    - RLS habilitado
    - Solo admins pueden ver
*/

-- Crear tabla de auditoría de conversiones
CREATE TABLE IF NOT EXISTS conversion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES document_import_batches(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES usuarios(id),
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  
  -- Timing
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms int,
  
  -- Contadores
  total_source_items int NOT NULL DEFAULT 0,
  total_inserted_items int NOT NULL DEFAULT 0,
  created_batch_count int NOT NULL DEFAULT 0,
  
  -- Resultados
  created_batch_ids uuid[] DEFAULT ARRAY[]::uuid[],
  conversion_report jsonb,
  
  -- Errores
  error_code text,
  error_message text,
  error_stack text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_batch_id ON conversion_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_status ON conversion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_started_at ON conversion_jobs(started_at DESC);

-- RLS
ALTER TABLE conversion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view conversion jobs"
  ON conversion_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Service role can manage conversion jobs"
  ON conversion_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE conversion_jobs IS 'Auditoría completa de conversiones de import batch a commission batches. Permite diagnóstico de fallos y verificación de integridad.';
