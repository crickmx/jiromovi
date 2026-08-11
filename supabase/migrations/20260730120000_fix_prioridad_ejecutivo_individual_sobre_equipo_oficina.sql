/*
  # Fix: una regla individual (agente + area, con ejecutivo) debe ganar sobre el
  # enrutamiento automatico por oficina ("Equipos habilitados").

  ## Contexto
  get_grupo_para_ticket() resolvia en este orden:
    1. tramites_reglas_por_tipo (agente + tipo especifico)
    2. automatico por oficina (tramite_team_tipo_config) -- NUNCA asigna ejecutivo,
       siempre regresa ejecutivo_id = NULL por diseno
    3. tramites_grupos_reglas (agente + area, SI puede traer ejecutivo_id)
    4. sin match

  Si un equipo esta habilitado en el Nivel 2 para un tipo, y un agente de ese
  equipo/oficina tiene ademas una regla individual en el Nivel 3 con ejecutivo
  asignado (ej. "Comercial Capita" habilitado para cotizacion_emision, y Hector
  Hugo Hernandez Rufino -> Yuri Aguilar Gonzalez en Asignacion), el Nivel 2
  siempre ganaba primero -- el grupo salia bien pero el ejecutivo nunca se
  aplicaba, sin ningun aviso en ninguna de las 2 pantallas de configuracion.

  ## Fix
  Se invierte el orden: ahora la regla individual (agente + area, antes Nivel 3)
  se evalua ANTES que el enrutamiento automatico por oficina (antes Nivel 2).
  Una regla configurada para un agente especifico es mas especifica que "cualquier
  agente de esta oficina va a este equipo", asi que debe ganar. El enrutamiento
  por oficina sigue aplicando igual para cualquier agente que NO tenga una regla
  individual configurada -- "Equipos habilitados" no pierde su proposito.

  No se toca el Nivel 1 (override manual agente+tipo, sigue siendo el mas
  especifico de todos) ni el Nivel 4 (sin match).
*/

CREATE OR REPLACE FUNCTION public.get_grupo_para_ticket(
  p_agente_id    uuid,
  p_tipo_tramite text DEFAULT NULL
)
RETURNS TABLE (grupo_id uuid, ejecutivo_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo_id    uuid;
  v_area       text;
  v_oficina_id uuid;
BEGIN
  IF p_tipo_tramite IS NOT NULL THEN
    SELECT tt.id, LOWER(tt.area)
      INTO v_tipo_id, v_area
    FROM ticket_tipos tt
    WHERE tt.value  = p_tipo_tramite
      AND tt.activo = true
    LIMIT 1;
  END IF;

  SELECT u.oficina_id INTO v_oficina_id FROM usuarios u WHERE u.id = p_agente_id;

  -- ── Nivel 1: override manual (agente + tipo específico) ──────────────────────
  IF v_tipo_id IS NOT NULL THEN
    RETURN QUERY
    SELECT r.grupo_id, r.ejecutivo_id
    FROM tramites_reglas_por_tipo r
    JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
    WHERE r.usuario_id = p_agente_id
      AND r.tipo_id    = v_tipo_id
      AND r.activo     = true
      AND g.activo     = true
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- ── Nivel 2: regla individual agente + área ("ASIGNACIÓN POR EQUIPOS") ───────
  -- Más específica que el enrutamiento automático por oficina: si el agente ya
  -- tiene un ejecutivo (o equipo) asignado a mano para esta área, gana aquí.
  IF v_area IS NOT NULL THEN
    RETURN QUERY
    SELECT r.grupo_id, r.ejecutivo_id
    FROM tramites_grupos_reglas r
    JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
    WHERE r.usuario_id  = p_agente_id
      AND LOWER(r.area) = v_area
      AND r.activo      = true
      AND g.activo      = true
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Comodín (area IS NULL) de la misma capa — antes de caer al enrutamiento por oficina.
  RETURN QUERY
  SELECT r.grupo_id, r.ejecutivo_id
  FROM tramites_grupos_reglas r
  JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
  WHERE r.usuario_id = p_agente_id
    AND r.area       IS NULL
    AND r.activo     = true
    AND g.activo     = true
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- ── Nivel 3: automático por oficina (equipos habilitados para el tipo) ───────
  -- Solo aplica si el agente no tiene ninguna regla individual (arriba). Nunca
  -- trae ejecutivo — es enrutamiento a nivel equipo, queda como "pool".
  IF v_tipo_id IS NOT NULL AND v_oficina_id IS NOT NULL THEN
    -- Prioridad: equipo con oficina específica coincidente
    RETURN QUERY
    SELECT g.id, NULL::uuid
    FROM tramite_team_tipo_config c
    JOIN tramites_grupos_visualizacion g ON g.id = c.team_id
    JOIN tramites_grupos_oficinas go ON go.grupo_id = g.id
    WHERE c.tipo_id     = v_tipo_id
      AND c.habilitado  = true
      AND g.activo      = true
      AND go.oficina_id = v_oficina_id
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Catch-all: equipo habilitado marcado "todas las oficinas"
    RETURN QUERY
    SELECT g.id, NULL::uuid
    FROM tramite_team_tipo_config c
    JOIN tramites_grupos_visualizacion g ON g.id = c.team_id
    WHERE c.tipo_id      = v_tipo_id
      AND c.habilitado   = true
      AND g.activo       = true
      AND g.all_offices  = true
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- ── Nivel 4: nada encontrado -> sin filas (comportamiento actual) ────────────
END;
$$;
