-- Equipos de trámite para cualquier rol + autoasignación al único ejecutivo
-- =========================================================================
--
-- 1) `tramites_grupos_reglas` dejaba de aplicar en cuanto el usuario dejaba de
--    ser Agente: el trigger de cambio de rol desactivaba todas sus reglas. Pero
--    a un Empleado, Gerente o Admin también se le levantan trámites, y sin regla
--    el trámite nace sin equipo — nadie lo atiende y el solicitante ni lo ve.
--    Se conserva la otra mitad del trigger (al PASAR a Agente se le quitan las
--    membresías operativas), que sí sigue siendo cierta: un agente no trabaja
--    dentro del equipo, lo atienden.
--
-- 2) Cuando el equipo resuelto tiene exactamente UN ejecutivo, el trámite se le
--    asigna a esa persona en vez de quedarse en el pool. Va al final de
--    `get_grupo_para_ticket` para que valga en los tres niveles de reglas.

CREATE OR REPLACE FUNCTION private.cleanup_tramite_relationships_on_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.rol = 'Agente' and old.rol is distinct from new.rol then
    delete from public.tramites_grupos_miembros
    where usuario_id = new.id;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_grupo_para_ticket(p_agente_id uuid, p_tipo_tramite text DEFAULT NULL::text)
 RETURNS TABLE(grupo_id uuid, ejecutivo_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo_id    uuid;
  v_area       text;
  v_oficina_id uuid;
  v_grupo      uuid;
  v_ejecutivo  uuid;
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
    SELECT r.grupo_id, r.ejecutivo_id
      INTO v_grupo, v_ejecutivo
    FROM tramites_reglas_por_tipo r
    JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
    WHERE r.usuario_id = p_agente_id
      AND r.tipo_id    = v_tipo_id
      AND r.activo     = true
      AND g.activo     = true
    LIMIT 1;
  END IF;

  -- ── Nivel 2: regla individual agente + área ("ASIGNACIÓN POR EQUIPOS") ───────
  -- Más específica que el enrutamiento automático por oficina: si el agente ya
  -- tiene un ejecutivo (o equipo) asignado a mano para esta área, gana aquí.
  IF v_grupo IS NULL AND v_area IS NOT NULL THEN
    SELECT r.grupo_id, r.ejecutivo_id
      INTO v_grupo, v_ejecutivo
    FROM tramites_grupos_reglas r
    JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
    WHERE r.usuario_id  = p_agente_id
      AND LOWER(r.area) = v_area
      AND r.activo      = true
      AND g.activo      = true
    LIMIT 1;
  END IF;

  -- Comodín (area IS NULL) de la misma capa — antes de caer al enrutamiento por oficina.
  IF v_grupo IS NULL THEN
    SELECT r.grupo_id, r.ejecutivo_id
      INTO v_grupo, v_ejecutivo
    FROM tramites_grupos_reglas r
    JOIN tramites_grupos_visualizacion g ON g.id = r.grupo_id
    WHERE r.usuario_id = p_agente_id
      AND r.area       IS NULL
      AND r.activo     = true
      AND g.activo     = true
    LIMIT 1;
  END IF;

  -- ── Nivel 3: automático por oficina (equipos habilitados para el tipo) ───────
  -- Solo aplica si el agente no tiene ninguna regla individual (arriba). Nunca
  -- trae ejecutivo de la regla — es enrutamiento a nivel equipo.
  IF v_grupo IS NULL AND v_tipo_id IS NOT NULL AND v_oficina_id IS NOT NULL THEN
    -- Prioridad: equipo con oficina específica coincidente
    SELECT g.id INTO v_grupo
    FROM tramite_team_tipo_config c
    JOIN tramites_grupos_visualizacion g ON g.id = c.team_id
    JOIN tramites_grupos_oficinas go ON go.grupo_id = g.id
    WHERE c.tipo_id     = v_tipo_id
      AND c.habilitado  = true
      AND g.activo      = true
      AND go.oficina_id = v_oficina_id
    LIMIT 1;
  END IF;

  -- Catch-all: equipo habilitado marcado "todas las oficinas"
  IF v_grupo IS NULL AND v_tipo_id IS NOT NULL THEN
    SELECT g.id INTO v_grupo
    FROM tramite_team_tipo_config c
    JOIN tramites_grupos_visualizacion g ON g.id = c.team_id
    WHERE c.tipo_id      = v_tipo_id
      AND c.habilitado   = true
      AND g.activo       = true
      AND g.all_offices  = true
    LIMIT 1;
  END IF;

  -- ── Nivel 4: nada encontrado -> sin filas (comportamiento de siempre) ────────
  IF v_grupo IS NULL THEN
    RETURN;
  END IF;

  -- Equipo de una sola persona: dejarlo en el pool no sirve de nada, no hay a
  -- quién repartirlo. Se asigna directo al único ejecutivo. Con dos o más, el
  -- pool se respeta (el HAVING no devuelve fila y v_ejecutivo se queda en NULL).
  IF v_ejecutivo IS NULL THEN
    SELECT (array_agg(m.usuario_id))[1] INTO v_ejecutivo
    FROM tramites_grupos_miembros m
    WHERE m.grupo_id      = v_grupo
      AND m.rol_en_equipo = 'ejecutivo'
    HAVING count(*) = 1;
  END IF;

  RETURN QUERY SELECT v_grupo, v_ejecutivo;
END;
$function$;

COMMENT ON COLUMN public.tramites_grupos_reglas.usuario_id IS
  'Usuario al que ATIENDE el equipo (cualquier rol, no solo Agente). No es membresía: eso es tramites_grupos_miembros.';
