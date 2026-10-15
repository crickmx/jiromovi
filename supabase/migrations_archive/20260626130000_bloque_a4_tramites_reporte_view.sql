-- ─── Bloque A4: Motor de Reportes ────────────────────────────────────────────
-- Vista vw_tramites_reporte: consolida tickets, campos, respuestas, equipos, áreas.
-- Trigger: actualiza tickets.completed_at al cerrar el estatus del trámite.
-- RPC get_reporte_tramites: filtra la vista por fecha / área / tipo / equipo.

-- 1. Vista principal de analytics
CREATE OR REPLACE VIEW public.vw_tramites_reporte AS
SELECT
  t.id,
  t.folio,
  t.tipo_tramite,
  tt.label                                        AS tipo_nombre,
  ta.nombre                                       AS area_nombre,
  tgv.nombre                                      AS equipo_nombre,
  u.nombre_completo                               AS creado_por,
  t.fecha_creacion                                AS created_at,
  t.completed_at,
  -- Lead Time en horas (creación → cierre; NULL si aún abierto)
  ROUND(
    EXTRACT(EPOCH FROM (
      COALESCE(t.completed_at, now()) - t.fecha_creacion
    )) / 3600.0, 2
  )                                               AS lead_time_horas,
  -- Estatus actual: última respuesta del campo sistema 'estatus'
  (
    SELECT r2.valor_texto
    FROM   public.tramite_respuestas    r2
    JOIN   public.tramite_tipo_campos   c2 ON r2.campo_id = c2.id
    WHERE  r2.tramite_id  = t.id
      AND  c2.sistema_key = 'estatus'
    ORDER BY r2.created_at DESC
    LIMIT 1
  )                                               AS estatus_actual,
  -- Total de eventos registrados en historial
  (
    SELECT COUNT(*)
    FROM   public.ticket_historial h
    WHERE  h.ticket_id = t.id
  )                                               AS total_eventos,
  -- Respuestas de campos custom (excluye campos sistema) como JSONB
  jsonb_object_agg(
    c.key,
    COALESCE(
      r.valor_texto,
      r.valor_numerico::text,
      r.valor_fecha::text,
      r.valor_json::text
    )
  ) FILTER (
    WHERE c.key IS NOT NULL
      AND c.is_sistema = false
  )                                               AS respuestas
FROM        public.tickets                    t
LEFT JOIN   public.ticket_tipos               tt  ON t.tipo_tramite         = tt.value
LEFT JOIN   public.tramites_areas             ta  ON tt.area_id             = ta.id
LEFT JOIN   public.tramites_grupos_visualizacion tgv ON t.grupo_asignado_id = tgv.id
LEFT JOIN   public.usuarios                   u   ON t.creado_por           = u.id
LEFT JOIN   public.tramite_respuestas         r   ON r.tramite_id           = t.id
LEFT JOIN   public.tramite_tipo_campos        c   ON r.campo_id             = c.id
                                                 AND c.activo = true
GROUP BY
  t.id, t.folio, t.tipo_tramite,
  tt.label, ta.nombre, tgv.nombre,
  u.nombre_completo,
  t.fecha_creacion, t.completed_at;

COMMENT ON VIEW public.vw_tramites_reporte IS
  'Vista de analytics para el motor de reportes. Combina tickets, respuestas, campos, equipos y áreas. Usar RPC get_reporte_tramites para filtrar.';

-- 2. RPC para exportar con filtros (no expone la vista directamente)
CREATE OR REPLACE FUNCTION public.get_reporte_tramites(
  p_desde        timestamptz,
  p_hasta        timestamptz,
  p_area_id      uuid DEFAULT NULL,
  p_tipo_tramite text DEFAULT NULL,
  p_equipo_id    uuid DEFAULT NULL
)
RETURNS SETOF public.vw_tramites_reporte
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT *
  FROM   public.vw_tramites_reporte
  WHERE  created_at >= p_desde
    AND  created_at <  p_hasta
    AND  (
           p_area_id IS NULL
           OR area_nombre = (
               SELECT nombre FROM public.tramites_areas WHERE id = p_area_id
             )
         )
    AND  (p_tipo_tramite IS NULL OR tipo_tramite = p_tipo_tramite)
    AND  (
           p_equipo_id IS NULL
           OR equipo_nombre = (
               SELECT nombre FROM public.tramites_grupos_visualizacion WHERE id = p_equipo_id
             )
         )
  ORDER BY created_at DESC;
$$;

COMMENT ON FUNCTION public.get_reporte_tramites IS
  'Filtra la vista vw_tramites_reporte por rango de fechas y opcionalmente por área, tipo o equipo.';

-- 3. Trigger: setear tickets.completed_at al alcanzar un estatus de terminación
--    Se dispara en INSERT sobre tramite_respuestas cuando el campo es el estatus sistema
--    y el valor coincide con una opción clasificada como 'terminacion' en la config del campo.
CREATE OR REPLACE FUNCTION public.trg_set_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_sistema_key   text;
  v_config        jsonb;
  v_es_terminacion boolean := false;
BEGIN
  -- Solo aplica si hay valor de texto (el estatus es texto)
  IF NEW.valor_texto IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener sistema_key y config del campo
  SELECT sistema_key, config
  INTO   v_sistema_key, v_config
  FROM   public.tramite_tipo_campos
  WHERE  id = NEW.campo_id
    AND  is_sistema = true
    AND  sistema_key = 'estatus';

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Verificar si el valor es una opción de terminación
  SELECT EXISTS (
    SELECT 1
    FROM   jsonb_array_elements(v_config -> 'opciones') AS opt
    WHERE  opt->>'slug'           = NEW.valor_texto
      AND  opt->>'clasificacion'  = 'terminacion'
  ) INTO v_es_terminacion;

  IF v_es_terminacion THEN
    UPDATE public.tickets
    SET    completed_at = now()
    WHERE  id           = NEW.tramite_id
      AND  completed_at IS NULL;
  ELSE
    -- Si se cambia a un estado NO terminal, limpiar completed_at
    UPDATE public.tickets
    SET    completed_at = NULL
    WHERE  id = NEW.tramite_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_completed_at ON public.tramite_respuestas;
CREATE TRIGGER trg_set_completed_at
  AFTER INSERT ON public.tramite_respuestas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_completed_at();

COMMENT ON FUNCTION public.trg_set_completed_at IS
  'Actualiza tickets.completed_at al insertar una respuesta de estatus sistema con clasificacion=terminacion. La limpia si el estatus cambia a uno no terminal.';
