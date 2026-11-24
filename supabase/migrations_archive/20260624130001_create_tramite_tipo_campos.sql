-- Form builder: field definitions per tramite type.
-- Sin registro = tipo sin campos personalizados (compatibilidad hacia atrás).
-- activo = false hace soft-delete preservando datos históricos.

CREATE TABLE IF NOT EXISTS public.tramite_tipo_campos (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tramite_tipo_id  uuid        NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  key              text        NOT NULL,
  label            text        NOT NULL,
  tipo             text        NOT NULL
                   CHECK (tipo IN ('texto_corto','texto_largo','numerico','adjunto','estatus','fecha','booleano')),
  requerido        boolean     NOT NULL DEFAULT false,
  ayuda            text,
  display_order    integer     NOT NULL DEFAULT 0,
  config           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  activo           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tramite_tipo_id, key)
);

CREATE INDEX idx_tramite_tipo_campos_tipo_id ON public.tramite_tipo_campos (tramite_tipo_id, display_order);

ALTER TABLE public.tramite_tipo_campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_write_tipo_campos"
  ON public.tramite_tipo_campos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

CREATE POLICY "auth_read_tipo_campos"
  ON public.tramite_tipo_campos FOR SELECT
  USING (auth.uid() IS NOT NULL);
