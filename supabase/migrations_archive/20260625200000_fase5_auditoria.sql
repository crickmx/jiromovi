-- Fase 5: historial de cambios para tipos de trámite
-- Registra: config actualizada, campos agregados/actualizados/eliminados, tipo creado

CREATE TABLE IF NOT EXISTS public.tramite_tipo_historial (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tramite_tipo_id uuid NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  accion         text NOT NULL,
  detalles       jsonb DEFAULT '{}',
  usuario_id     uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_nombre text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_tipo_fecha
  ON public.tramite_tipo_historial(tramite_tipo_id, created_at DESC);

ALTER TABLE public.tramite_tipo_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_historial_insert" ON public.tramite_tipo_historial
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "auth_historial_select" ON public.tramite_tipo_historial
  FOR SELECT TO authenticated USING (true);
