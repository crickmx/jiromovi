-- Días no hábiles personalizados (complementa los festivos oficiales MX calculados en código)
CREATE TABLE IF NOT EXISTS public.dias_no_habiles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha       date        UNIQUE NOT NULL,
  descripcion text        NOT NULL,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dias_no_habiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dias_no_habiles_select" ON public.dias_no_habiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dias_no_habiles_write" ON public.dias_no_habiles
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente')
    )
  );
