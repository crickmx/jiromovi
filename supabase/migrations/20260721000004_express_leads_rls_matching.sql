/*
  # seguros.express — Matching por distancia + RLS (Parte C.4 / D)

  Funciones:
    - express_es_admin(): ¿el usuario actual es Administrador? (para RLS)
    - express_distancia_km(): distancia en km entre dos puntos vía earthdistance.
    - express_lead_en_alcance(lead_id): ¿el agente actual puede VER este lead sin
      tomarlo todavía? (habilitado + activo + dentro del anillo actual, o el lead
      no tiene coordenadas → visible a todos los habilitados). Se usa en RLS.
    - express_agentes_pendientes_notificar(lead_id): agentes que califican en el
      anillo actual y aún no fueron notificados (lo consumen las edge functions).

  RLS (Parte C.4):
    Un agente sólo puede SELECT un express_lead si:
      · es suyo (agente_asignado_id = auth.uid()), o
      · está 'notificado' sin asignar Y está dentro de su alcance actual.
    Nunca ve leads fuera de su alcance ni tomados por otro agente.
    (Los administradores ven todos, para el panel de configuración/monitoreo.)
    No hay INSERT/UPDATE/DELETE para authenticated: las escrituras pasan por la
    edge function (service role) y por los RPC SECURITY DEFINER claim/convert.

  Nota de diseño (documentada): la Parte D.1 menciona un fallback por
  "misma ciudad / mismo estado", pero ni `usuarios` ni `oficinas` tienen columnas
  estructuradas de ciudad/estado (sólo `oficinas.domicilio` texto libre). Por eso
  el matching real implementado es: anillo por km (expandible por el cron hasta el
  tope) y, cuando el lead no trae coordenadas (visitante negó GPS y sólo dejó
  dirección/CP), se notifica a TODOS los agentes habilitados. Si en el futuro se
  agregan ciudad/estado al perfil, aquí es donde se insertarían los niveles
  intermedios del cascadeo.
*/

-- ─────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.express_es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'Administrador'
  );
$$;

CREATE OR REPLACE FUNCTION public.express_distancia_km(
  p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT CASE
    WHEN p_lat1 IS NULL OR p_lng1 IS NULL OR p_lat2 IS NULL OR p_lng2 IS NULL
      THEN NULL
    ELSE earth_distance(
           ll_to_earth(p_lat1::float8, p_lng1::float8),
           ll_to_earth(p_lat2::float8, p_lng2::float8)
         ) / 1000.0
  END;
$$;

-- ¿El agente actual puede ver este lead (sin tomarlo)? Usada en RLS.
CREATE OR REPLACE FUNCTION public.express_lead_en_alcance(p_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_habilitado boolean;
  v_activo     boolean;
  v_ag_lat     numeric;
  v_ag_lng     numeric;
  v_lead       public.express_leads%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT seguros_express_habilitado, activo, ubicacion_lat, ubicacion_lng
    INTO v_habilitado, v_activo, v_ag_lat, v_ag_lng
  FROM public.usuarios
  WHERE id = v_uid;

  IF NOT COALESCE(v_habilitado, false) OR NOT COALESCE(v_activo, false) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_lead FROM public.express_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Lead sin coordenadas: visible a todos los habilitados (no se puede geofiltrar).
  IF v_lead.lat IS NULL OR v_lead.lng IS NULL THEN
    RETURN true;
  END IF;

  -- Con coordenadas: el agente debe tener ubicación y estar dentro del anillo.
  IF v_ag_lat IS NULL OR v_ag_lng IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.express_distancia_km(v_ag_lat, v_ag_lng, v_lead.lat, v_lead.lng)
         <= v_lead.anillo_km_actual;
END;
$$;

-- Agentes que califican en el anillo actual y NO fueron notificados aún.
-- La consumen las edge functions (service role) para el fan-out de notificaciones.
CREATE OR REPLACE FUNCTION public.express_agentes_pendientes_notificar(p_lead_id uuid)
RETURNS TABLE (usuario_id uuid, distancia_km numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lead public.express_leads%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM public.express_leads WHERE id = p_lead_id;
  IF NOT FOUND
     OR v_lead.estado <> 'notificado'
     OR v_lead.agente_asignado_id IS NOT NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id,
         public.express_distancia_km(u.ubicacion_lat, u.ubicacion_lng, v_lead.lat, v_lead.lng)
  FROM public.usuarios u
  WHERE u.seguros_express_habilitado = true
    AND COALESCE(u.activo, false) = true
    AND COALESCE(u.is_deleted, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.express_lead_agentes_notificados n
      WHERE n.lead_id = p_lead_id AND n.usuario_id = u.id
    )
    AND (
      -- Lead sin coordenadas → todos los habilitados.
      (v_lead.lat IS NULL OR v_lead.lng IS NULL)
      OR
      -- Lead con coordenadas → agente con ubicación dentro del anillo actual.
      (u.ubicacion_lat IS NOT NULL AND u.ubicacion_lng IS NOT NULL
        AND public.express_distancia_km(u.ubicacion_lat, u.ubicacion_lng, v_lead.lat, v_lead.lng)
            <= v_lead.anillo_km_actual)
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Permisos de ejecución
-- ─────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.express_es_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.express_distancia_km(numeric, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.express_lead_en_alcance(uuid) TO authenticated;
-- Enumera agentes: sólo service role (edge functions). Se le quita a public.
REVOKE ALL ON FUNCTION public.express_agentes_pendientes_notificar(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.express_agentes_pendientes_notificar(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.express_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.express_leads FROM anon;

DROP POLICY IF EXISTS express_leads_select ON public.express_leads;
CREATE POLICY express_leads_select ON public.express_leads
  FOR SELECT TO authenticated
  USING (
    public.express_es_admin()
    OR agente_asignado_id = auth.uid()
    OR (
      estado = 'notificado'
      AND agente_asignado_id IS NULL
      AND public.express_lead_en_alcance(id)
    )
  );
-- (Sin políticas de INSERT/UPDATE/DELETE para authenticated: RLS niega por
--  defecto; las escrituras van por service role y por los RPC SECURITY DEFINER.)

ALTER TABLE public.express_leads_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.express_leads_config FROM anon;

DROP POLICY IF EXISTS express_config_select ON public.express_leads_config;
CREATE POLICY express_config_select ON public.express_leads_config
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS express_config_update ON public.express_leads_config;
CREATE POLICY express_config_update ON public.express_leads_config
  FOR UPDATE TO authenticated
  USING (public.express_es_admin())
  WITH CHECK (public.express_es_admin());

ALTER TABLE public.express_lead_agentes_notificados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.express_lead_agentes_notificados FROM anon;

DROP POLICY IF EXISTS express_notificados_select ON public.express_lead_agentes_notificados;
CREATE POLICY express_notificados_select ON public.express_lead_agentes_notificados
  FOR SELECT TO authenticated
  USING (public.express_es_admin() OR usuario_id = auth.uid());
