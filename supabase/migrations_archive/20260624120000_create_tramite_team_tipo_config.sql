-- REQ-07: Habilitar toggle de tipos de trámite por equipo
-- Tabla: tramite_team_tipo_config
-- Permite que un admin active/desactive tipos de trámite específicos para un equipo.
-- Sin registro = tipo habilitado por defecto (backwards compatible).

CREATE TABLE IF NOT EXISTS public.tramite_team_tipo_config (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     uuid NOT NULL REFERENCES public.tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  tipo_id     uuid NOT NULL REFERENCES public.ticket_tipos(id) ON DELETE CASCADE,
  habilitado  boolean NOT NULL DEFAULT true,
  updated_at  timestamptz DEFAULT now(),
  updated_by  uuid REFERENCES public.usuarios(id),
  UNIQUE(team_id, tipo_id)
);

-- RLS
ALTER TABLE public.tramite_team_tipo_config ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden escribir
CREATE POLICY "admin_write_team_tipo_config"
  ON public.tramite_team_tipo_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

-- Usuarios autenticados pueden leer (para filtrar visibilidad de tickets)
CREATE POLICY "auth_read_team_tipo_config"
  ON public.tramite_team_tipo_config
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Índice para búsquedas por equipo
CREATE INDEX idx_tramite_team_tipo_config_team_id
  ON public.tramite_team_tipo_config(team_id);
