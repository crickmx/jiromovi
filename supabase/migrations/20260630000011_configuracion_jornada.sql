-- Configuración global de jornada laboral (una sola fila)
CREATE TABLE IF NOT EXISTS public.configuracion_jornada (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  hora_inicio           time    NOT NULL DEFAULT '09:00',
  hora_fin              time    NOT NULL DEFAULT '18:00',
  horas_productivas_dia integer NOT NULL DEFAULT 8 CHECK (horas_productivas_dia BETWEEN 1 AND 24),
  actualizado_por       uuid    REFERENCES public.usuarios(id) ON DELETE SET NULL,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Insertar fila inicial solo si no existe ninguna
INSERT INTO public.configuracion_jornada (hora_inicio, hora_fin, horas_productivas_dia)
SELECT '09:00', '18:00', 8
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion_jornada);

ALTER TABLE public.configuracion_jornada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracion_jornada_select" ON public.configuracion_jornada
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "configuracion_jornada_write" ON public.configuracion_jornada
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );
