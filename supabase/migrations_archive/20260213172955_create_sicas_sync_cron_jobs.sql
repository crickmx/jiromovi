/*
  # Configuración de Cron Jobs para Sincronización Automática SICAS

  1. Propósito
    - Configurar trabajos programados (cron jobs) para sincronización automática
    - Ejecutar sincronizaciones periódicas sin intervención manual
    - Mantener datos actualizados en la base de datos espejo

  2. Trabajos Programados
    - Documentos/Producción: cada 3 horas
    - Comisiones Pendientes: cada 6 horas
    - Comisiones Pagadas: cada 12 horas
    - Cobranza Pendiente: cada 12 horas

  3. Configuración
    - Usa pg_cron para programación de tareas
    - Llama a edge functions mediante HTTP
    - Registra resultados en sicas_sync_runs

  Nota: Los cron jobs están desactivados por defecto.
  Para activarlos, use Supabase scheduled edge functions.
*/

-- =====================================================
-- CREAR FUNCIONES DE AYUDA PARA CRON JOBS
-- =====================================================

CREATE OR REPLACE FUNCTION invoke_edge_function(
  function_name text,
  payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO sicas_sync_runs (
    module,
    keycode,
    report_name,
    status,
    error_message,
    started_at
  ) VALUES (
    'cron',
    function_name,
    'Scheduled sync job',
    'failed',
    'Use Supabase scheduled edge functions or external cron service',
    now()
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Use Supabase Edge Functions with scheduled triggers instead'
  );
END;
$$;

-- =====================================================
-- TABLA DE CONFIGURACIÓN DE CRON JOBS
-- =====================================================

CREATE TABLE IF NOT EXISTS sicas_cron_config (
  job_name text PRIMARY KEY,
  edge_function text NOT NULL,
  schedule text NOT NULL,
  enabled boolean DEFAULT false,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insertar configuración de trabajos
INSERT INTO sicas_cron_config (job_name, edge_function, schedule, enabled)
VALUES
  ('sync_documents', 'sicas-sync-documents', '0 0-23/3 * * *', false),
  ('sync_commissions_pending', 'sicas-sync-commissions', '0 0-23/6 * * *', false),
  ('sync_commissions_paid', 'sicas-sync-commissions', '0 0-23/12 * * *', false),
  ('sync_receivables', 'sicas-sync-receivables', '0 0-23/12 * * *', false)
ON CONFLICT (job_name) DO NOTHING;

-- =====================================================
-- RLS PARA TABLA DE CONFIGURACIÓN
-- =====================================================

ALTER TABLE sicas_cron_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sicas_cron_config"
  ON sicas_cron_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view cron config"
  ON sicas_cron_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Admins can update cron config"
  ON sicas_cron_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

COMMENT ON TABLE sicas_cron_config IS 'Configuración de trabajos programados para sincronización SICAS.

INSTRUCCIONES PARA CONFIGURAR SINCRONIZACIÓN AUTOMÁTICA:

RECOMENDADO: Usar Supabase Scheduled Edge Functions
1. En el dashboard de Supabase, navega a Edge Functions
2. Selecciona cada función y configura scheduled triggers:
   - sicas-sync-documents: cada 3 horas (0 0-23/3 * * *)
   - sicas-sync-commissions: cada 6 horas (0 0-23/6 * * *)
   - sicas-sync-receivables: cada 12 horas (0 0-23/12 * * *)

ALTERNATIVA: Usar servicios externos
- Vercel Cron Jobs
- GitHub Actions con schedule
- AWS EventBridge
- Google Cloud Scheduler

La sincronización manual siempre está disponible desde la UI de administración.';
