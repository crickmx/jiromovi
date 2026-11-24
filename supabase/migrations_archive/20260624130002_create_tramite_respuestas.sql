-- Stores per-field responses for each submitted tramite.
-- Typed columns (not single jsonb) for cleaner indexing and RLS.
-- UNIQUE(tramite_id, campo_id) allows upsert on re-edit.

CREATE TABLE IF NOT EXISTS public.tramite_respuestas (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tramite_id       uuid        NOT NULL REFERENCES public.tramites(id) ON DELETE CASCADE,
  campo_id         uuid        NOT NULL REFERENCES public.tramite_tipo_campos(id),
  valor_texto      text,
  valor_numerico   numeric,
  valor_fecha      date,
  valor_booleano   boolean,
  valor_json       jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tramite_id, campo_id)
);

CREATE INDEX idx_tramite_respuestas_tramite ON public.tramite_respuestas (tramite_id);
CREATE INDEX idx_tramite_respuestas_campo   ON public.tramite_respuestas (campo_id);

ALTER TABLE public.tramite_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_respuestas"
  ON public.tramite_respuestas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_write_respuestas"
  ON public.tramite_respuestas FOR ALL
  USING (auth.uid() IS NOT NULL);
