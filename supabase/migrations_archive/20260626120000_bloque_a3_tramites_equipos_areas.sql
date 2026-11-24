-- ─── Bloque A3: tramites_equipos_areas ───────────────────────────────────────
-- Junction equipo × área con lista de tipos de trámite disponibles.
-- tramites_activos: array de ticket_tipos.id que ese equipo maneja en esa área.
-- RPC get_tipos_para_equipo: usada por el modal de creación para filtrar tipos.

-- 1. Tabla
CREATE TABLE IF NOT EXISTS public.tramites_equipos_areas (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id        uuid    NOT NULL
                           REFERENCES public.tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  area_id          uuid    NOT NULL
                           REFERENCES public.tramites_areas(id)               ON DELETE CASCADE,
  tramites_activos uuid[]  NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipo_id, area_id)
);

COMMENT ON TABLE public.tramites_equipos_areas IS
  'Define qué tipos de trámite (ticket_tipos.id[]) puede gestionar un equipo dentro de un área.';
COMMENT ON COLUMN public.tramites_equipos_areas.tramites_activos IS
  'Array de ticket_tipos.id. Usar tramites_activos @> ARRAY[tipo_id] para verificar pertenencia.';

-- 2. Índice GIN para búsquedas de containment: WHERE tramites_activos @> ARRAY[id]
CREATE INDEX IF NOT EXISTS idx_equipos_areas_tramites_gin
  ON public.tramites_equipos_areas USING gin(tramites_activos);

CREATE INDEX IF NOT EXISTS idx_equipos_areas_equipo
  ON public.tramites_equipos_areas(equipo_id);

CREATE INDEX IF NOT EXISTS idx_equipos_areas_area
  ON public.tramites_equipos_areas(area_id);

-- 3. RPC: tipos de trámite disponibles para un equipo (JOIN completo para el UI)
CREATE OR REPLACE FUNCTION public.get_tipos_para_equipo(p_equipo_id uuid)
RETURNS TABLE (
  tipo_id    uuid,
  value      text,
  label      text,
  area       text,
  color      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT
    tt.id    AS tipo_id,
    tt.value,
    tt.label,
    ta.nombre AS area,
    tt.color
  FROM  public.tramites_equipos_areas tea
  JOIN  public.ticket_tipos           tt  ON tt.id = ANY(tea.tramites_activos)
  JOIN  public.tramites_areas         ta  ON ta.id = tea.area_id
  WHERE tea.equipo_id = p_equipo_id
    AND tt.activo    = true
    AND ta.activa    = true
  ORDER BY ta.nombre, tt.label;
$$;

COMMENT ON FUNCTION public.get_tipos_para_equipo IS
  'Devuelve los tipos de trámite activos que un equipo tiene habilitados en su(s) área(s).';

-- 4. RPC auxiliar: equipos que pueden crear un tipo de trámite dado
CREATE OR REPLACE FUNCTION public.get_equipos_para_tipo(p_tipo_id uuid)
RETURNS TABLE (
  equipo_id uuid,
  equipo_nombre text,
  area_nombre   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    tgv.id       AS equipo_id,
    tgv.nombre   AS equipo_nombre,
    ta.nombre    AS area_nombre
  FROM  public.tramites_equipos_areas tea
  JOIN  public.tramites_grupos_visualizacion tgv ON tgv.id = tea.equipo_id
  JOIN  public.tramites_areas               ta  ON ta.id  = tea.area_id
  WHERE tea.tramites_activos @> ARRAY[p_tipo_id]
    AND tgv.activo = true
  ORDER BY tgv.nombre;
$$;

-- 5. RLS
ALTER TABLE public.tramites_equipos_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tea_select"
  ON public.tramites_equipos_areas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "tea_admin"
  ON public.tramites_equipos_areas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND activo = true
    )
  );
