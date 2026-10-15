-- Pausas de plazo ("En espera"): registra periodos donde el timer del trámite no corre
CREATE TABLE IF NOT EXISTS public.tramite_pausas (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tramite_id            uuid        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  estatus_slug          text        NOT NULL,
  inicio_pausa          timestamptz NOT NULL DEFAULT now(),
  fin_pausa             timestamptz,
  dias_habiles_pausados integer,
  creado_por            uuid        REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Índice para encontrar la pausa activa de un trámite en O(1)
CREATE INDEX IF NOT EXISTS tramite_pausas_activa_idx
  ON public.tramite_pausas (tramite_id, fin_pausa)
  WHERE fin_pausa IS NULL;

ALTER TABLE public.tramite_pausas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tramite_pausas_select" ON public.tramite_pausas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tramite_pausas_write" ON public.tramite_pausas
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente', 'Empleado')
    )
  );
