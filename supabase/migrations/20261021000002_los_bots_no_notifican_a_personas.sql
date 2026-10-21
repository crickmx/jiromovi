-- Los trámites de los bots dejan de avisarle a las personas
-- =========================================================
--
-- Los agentes de prueba levantan trámites, comentan y cambian estatus todo el
-- día. Cada una de esas acciones dispara un aviso, y los avisos no distinguen:
-- al Administrador le llegaban campanita y WhatsApp de trabajo que nadie hizo.
--
-- La regla es **un trámite de bot solo le avisa a bots**, no "los trámites de
-- bot no avisan". Los agentes están ahí para ejercitar el flujo completo, y las
-- notificaciones son parte de lo que tienen que poder romper: si se apagaran por
-- completo, el día que el motor de avisos falle nadie lo vería hasta que le
-- pasara a una persona.
--
-- Se corta en DOS lugares porque hay dos caminos que no se tocan:
--
--   · `resolver_destinatarios_aviso` — todo lo que sale por los triggers de la
--     base (comentario, cambio de estatus, actualización, documento) y el aviso
--     de trámite nuevo del frontend. Es el grueso.
--   · `enviar_notificacion_individual` — los avisos sueltos escritos a mano en
--     `TramiteDetalle` y `NuevoTramiteModal` (menciones, reasignaciones, "sin
--     equipo asignado"). Son siete llamadas y **todas mandan WhatsApp**, así que
--     filtrar solo la campanita no habría servido de nada.
--
-- Y el contador del sidebar deja de contarlos, igual que el tablero.

-- Quién decide qué es "de bot". Un solo lugar: si esto se escribe dos veces, un
-- día los dos caminos empiezan a filtrar distinto y nadie se entera.
CREATE OR REPLACE FUNCTION public.es_tramite_de_bot(p_ticket_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Lo levantó un bot O es para un bot: mismo criterio que el toggle del
  -- tablero. Mirar un solo lado dejaría fuera los que mezclan persona y agente.
  SELECT EXISTS (
    SELECT 1 FROM tickets t
    LEFT JOIN usuarios ua ON ua.id = t.agente_id
    LEFT JOIN usuarios uc ON uc.id = t.creado_por
    WHERE t.id = p_ticket_id
      AND (COALESCE(ua.es_bot, false) OR COALESCE(uc.es_bot, false))
  );
$function$;

COMMENT ON FUNCTION public.es_tramite_de_bot(uuid) IS
  'true si el trámite lo levantó un agente de IA o es para uno. Mismo criterio que el toggle Reales/Bots del tablero.';

-- ¿Este aviso es de un trámite de bot y va hacia una persona?
--
-- Se deduce del `accion_url` (`/tramites/<uuid>`) porque es el único dato que
-- TODAS las llamadas traen. Cualquier cosa que no encaje —sin url, otra ruta,
-- trámite que no existe— devuelve false: ante la duda el aviso SALE. Un aviso
-- de más molesta; uno que desaparece en silencio es el que hace daño.
CREATE OR REPLACE FUNCTION public.aviso_de_bot_para_persona(p_user_id uuid, p_accion_url text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket uuid;
BEGIN
  IF p_accion_url IS NULL THEN RETURN false; END IF;

  v_ticket := NULLIF(substring(p_accion_url from '/tramites/([0-9a-fA-F-]{36})'), '')::uuid;
  IF v_ticket IS NULL THEN RETURN false; END IF;

  IF NOT es_tramite_de_bot(v_ticket) THEN RETURN false; END IF;

  RETURN NOT COALESCE((SELECT es_bot FROM usuarios WHERE id = p_user_id), false);
EXCEPTION WHEN others THEN
  -- Un error aquí nunca debe tumbar un aviso legítimo.
  RETURN false;
END;
$function$;

COMMENT ON FUNCTION public.aviso_de_bot_para_persona(uuid, text) IS
  'true si el aviso es sobre un trámite de bot y el destinatario es una persona. Ante cualquier duda devuelve false: el aviso sale.';

GRANT EXECUTE ON FUNCTION public.es_tramite_de_bot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aviso_de_bot_para_persona(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolver_destinatarios_aviso(
  p_ticket_id uuid,
  p_codigo_tipo text
)
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_t      RECORD;
  v_tipo   RECORD;
  v_roles  text[];
  v_ids    uuid[] := ARRAY[]::uuid[];
  v_lider  uuid;
BEGIN
  SELECT agente_id, assigned_to_user_id, grupo_asignado_id
  INTO v_t
  FROM tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN RETURN ARRAY[]::uuid[]; END IF;

  SELECT id, destinatarios_roles INTO v_tipo
  FROM correo_tipos_notificacion WHERE codigo = p_codigo_tipo;

  v_roles := COALESCE(v_tipo.destinatarios_roles, ARRAY[]::text[]);

  IF array_length(v_roles, 1) IS NULL THEN
    IF v_t.agente_id IS NOT NULL THEN v_ids := array_append(v_ids, v_t.agente_id); END IF;
    IF v_t.assigned_to_user_id IS NOT NULL THEN v_ids := array_append(v_ids, v_t.assigned_to_user_id); END IF;
  ELSE
    IF 'solicitante' = ANY(v_roles) AND v_t.agente_id IS NOT NULL THEN
      v_ids := array_append(v_ids, v_t.agente_id);
    END IF;

    IF 'responsable' = ANY(v_roles) AND v_t.assigned_to_user_id IS NOT NULL THEN
      v_ids := array_append(v_ids, v_t.assigned_to_user_id);
    END IF;

    IF 'lider_equipo' = ANY(v_roles)
       AND v_t.assigned_to_user_id IS NULL
       AND v_t.grupo_asignado_id IS NOT NULL THEN
      SELECT usuario_id INTO v_lider
      FROM tramites_grupos_miembros
      WHERE grupo_id = v_t.grupo_asignado_id
        AND rol_en_equipo IN ('lider', 'supervisor', 'director')
      ORDER BY CASE rol_en_equipo WHEN 'lider' THEN 1 WHEN 'supervisor' THEN 2 ELSE 3 END
      LIMIT 1;
      IF v_lider IS NOT NULL THEN v_ids := array_append(v_ids, v_lider); END IF;
    END IF;

    IF 'lista_fija' = ANY(v_roles) AND v_tipo.id IS NOT NULL THEN
      v_ids := v_ids || COALESCE(
        (SELECT array_agg(usuario_id) FROM correo_destinatarios_notificacion
         WHERE tipo_notificacion_id = v_tipo.id),
        ARRAY[]::uuid[]
      );
    END IF;
  END IF;

  IF array_length(v_ids, 1) IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;

  -- Un tramite de bot solo le avisa a bots.
  --
  -- No se corta el aviso entero: los agentes de prueba estan ahi para ejercitar
  -- el flujo completo, y las notificaciones son parte de lo que tienen que
  -- poder romper. Lo que se corta es que lleguen a una persona.
  IF es_tramite_de_bot(p_ticket_id) THEN
    RETURN COALESCE((
      SELECT array_agg(DISTINCT x) FROM unnest(v_ids) x
      WHERE EXISTS (SELECT 1 FROM usuarios u WHERE u.id = x AND u.es_bot)
    ), ARRAY[]::uuid[]);
  END IF;

  RETURN (SELECT array_agg(DISTINCT x) FROM unnest(v_ids) x);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_tramites_attention_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COUNT(*)::bigint FROM tickets t
  WHERE t.eliminado_at IS NULL
    AND t.cerrado_en IS NULL
    AND NOT es_tramite_de_bot(t.id)
    AND (
      t.requiere_atencion_manual
      OR (
        t.ultima_accion_por IS NOT NULL
        AND (t.ultima_accion_por = t.agente_id OR t.ultima_accion_por = t.agente_usuario_id)
        AND t.agente_id IS DISTINCT FROM auth.uid()
        AND t.agente_usuario_id IS DISTINCT FROM auth.uid()
      )
    );
$function$;

-- La guarda dentro de `enviar_notificacion_individual`
-- ----------------------------------------------------
--
-- Esta función tiene ~100 líneas y manda WhatsApp además de escribir la
-- campanita, así que no basta con un trigger sobre `notificaciones`: la
-- campanita se cortaría y el WhatsApp saldría igual.
--
-- No se reescribe a mano. Se lee la definición VIVA con `pg_get_functiondef` y
-- se le inserta la guarda justo después del BEGIN. Dos razones: reconstruir 100
-- líneas de memoria es como se cuela un error que no da síntoma, y la versión
-- viva de esta base no siempre coincide con la del repo — ya pasó con
-- `tickets_select_v6` y con `ejecutar_recurrencias`. Esto parte de lo que de
-- verdad está corriendo.
DO $migracion$
DECLARE
  v_def    text;
  v_marca  text := 'aviso_de_bot_para_persona';
  v_ancla  text := E'\nBEGIN\n';
  v_pos    int;
  v_guarda text := E'\n-- Los trámites de los bots no le avisan a las personas (ver migración 20261021000002).\nIF aviso_de_bot_para_persona(p_user_id, p_accion_url) THEN\n  RETURN NULL;\nEND IF;\n';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'enviar_notificacion_individual'
    AND pg_get_function_identity_arguments(p.oid) =
        'p_user_id uuid, p_titulo text, p_mensaje text, p_modulo text, p_accion_url text, p_enviar_whatsapp boolean';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No existe enviar_notificacion_individual con esa firma. Revisar antes de seguir.';
  END IF;

  IF position(v_marca in v_def) > 0 THEN
    RAISE NOTICE 'La guarda ya estaba puesta; no se toca.';
    RETURN;
  END IF;

  v_pos := position(v_ancla in v_def);
  IF v_pos = 0 THEN
    RAISE EXCEPTION 'No se encontró el BEGIN del cuerpo; no se modifica nada a ciegas.';
  END IF;

  v_def := left(v_def, v_pos + length(v_ancla) - 1) || v_guarda || substr(v_def, v_pos + length(v_ancla));
  EXECUTE v_def;
  RAISE NOTICE 'Guarda insertada en enviar_notificacion_individual.';
END;
$migracion$;
