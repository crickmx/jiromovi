-- Migración de Índices de Rendimiento y Optimización para MOVI Digital
-- Creado: 2026-09-11

-- 1. Optimizaciones para extracción y consulta de pólizas PDF
CREATE INDEX IF NOT EXISTS idx_poliza_datos_extraidos_ticket_id
  ON public.poliza_datos_extraidos (ticket_id);

CREATE INDEX IF NOT EXISTS idx_poliza_datos_extraidos_aseguradora
  ON public.poliza_datos_extraidos (aseguradora);

CREATE INDEX IF NOT EXISTS idx_poliza_datos_extraidos_documento
  ON public.poliza_datos_extraidos (documento);

-- 2. Optimizaciones para cola de entrenamiento de OCR
CREATE INDEX IF NOT EXISTS idx_lector_cola_ticket_estado
  ON public.lector_cola_entrenamiento (ticket_id, estado);

CREATE INDEX IF NOT EXISTS idx_lector_cola_aseguradora
  ON public.lector_cola_entrenamiento (aseguradora);

-- 3. Índices parciales en archivos de trámites activos (excluyendo borrados lógicos)
CREATE INDEX IF NOT EXISTS idx_ticket_archivos_ticket_activo
  ON public.ticket_archivos (ticket_id)
  WHERE eliminado_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_archivos_categoria_activo
  ON public.ticket_archivos (categoria_id, ticket_id)
  WHERE eliminado_at IS NULL AND categoria_id IS NOT NULL;

-- 4. Optimización de búsquedas en perfiles de clientes y sincronización
CREATE INDEX IF NOT EXISTS idx_sicas_customer_profiles_email_clean
  ON public.sicas_customer_profiles (LOWER(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sicas_sync_runs_status_started
  ON public.sicas_sync_runs (status, started_at DESC);
