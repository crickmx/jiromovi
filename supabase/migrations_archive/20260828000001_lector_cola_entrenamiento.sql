-- Cola de PDFs que el extractor no pudo procesar, para entrenamiento en lector.movi.digital

CREATE TABLE IF NOT EXISTS public.lector_cola_entrenamiento (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  archivo_id   uuid REFERENCES public.ticket_archivos(id) ON DELETE SET NULL,
  archivo_url  text NOT NULL,
  aseguradora  text,
  estado       text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesado')),
  creado_en    timestamptz NOT NULL DEFAULT now(),
  procesado_en timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lector_cola_archivo
  ON public.lector_cola_entrenamiento(archivo_id)
  WHERE archivo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lector_cola_estado ON public.lector_cola_entrenamiento(estado);

ALTER TABLE public.lector_cola_entrenamiento ENABLE ROW LEVEL SECURITY;

-- Empleados/Gerentes/Admins pueden ver la cola
CREATE POLICY "lector_cola_select" ON public.lector_cola_entrenamiento
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.rol IN ('Administrador', 'Gerente', 'Empleado')
      AND u.deleted_at IS NULL
    )
  );

-- Solo admins pueden marcar como procesado
CREATE POLICY "lector_cola_update" ON public.lector_cola_entrenamiento
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.deleted_at IS NULL
    )
  );

-- Edge function (service_role) puede insertar/leer sin restricciones
CREATE POLICY "lector_cola_service" ON public.lector_cola_entrenamiento
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
