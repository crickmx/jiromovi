CREATE TABLE IF NOT EXISTS public.maestro_mapeo_pendiente (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id        uuid NOT NULL REFERENCES public.maestro_agentes(id)  ON DELETE CASCADE,
  user_id_propuesto uuid NOT NULL REFERENCES public.usuarios(id)         ON DELETE CASCADE,
  propuesto_por    uuid             REFERENCES public.usuarios(id)       ON DELETE SET NULL,
  ticket_id        uuid             REFERENCES public.tickets(id)        ON DELETE SET NULL,
  created_at       timestamptz      DEFAULT now(),
  UNIQUE (agente_id, user_id_propuesto)
);

ALTER TABLE public.maestro_mapeo_pendiente ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede insertar (proponer)
CREATE POLICY "insert_mapeo_pendiente" ON public.maestro_mapeo_pendiente
  FOR INSERT TO authenticated WITH CHECK (true);

-- Solo admins pueden leer, validar (delete) o rechazar
CREATE POLICY "admin_mapeo_pendiente" ON public.maestro_mapeo_pendiente
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );
