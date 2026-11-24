-- Fase 2 de un solo motor: UN solo lugar que decide a quién se le avisa
-- =====================================================================
--
-- Las reglas quedaron duplicadas el 19/10: en `src/lib/destinatariosAviso.ts`
-- (lo que usa el frontend) y dentro de `notify_tramite_recipients` (lo que
-- usan los triggers). Son las mismas reglas escritas dos veces, en dos
-- lenguajes — el tipo de duplicación que no da error nunca: simplemente un día
-- alguien cambia una y los dos caminos empiezan a avisar distinto.
--
-- Ahora viven aquí, y el frontend las consulta por RPC.
--
-- Las reglas, para no tener que leer el código:
--   · Sin roles configurados → el comportamiento de siempre: solicitante y
--     responsable. Una configuración en blanco nunca significa "a nadie".
--   · El líder es RESPALDO: solo entra si el trámite no tiene responsable. Con
--     los dos puestos, al jefe le llegaría todo y dejaría de leerlo.
--   · Nadie recibe dos veces, aunque sea solicitante y responsable a la vez.

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
  RETURN (SELECT array_agg(DISTINCT x) FROM unnest(v_ids) x);
END;
$function$;

COMMENT ON FUNCTION public.resolver_destinatarios_aviso(uuid, text) IS
  'A quién se le avisa de un trámite, según correo_tipos_notificacion.destinatarios_roles. Único lugar donde viven estas reglas: lo usan los triggers de la base y el frontend por RPC.';

GRANT EXECUTE ON FUNCTION public.resolver_destinatarios_aviso(uuid, text) TO authenticated;

-- `notify_tramite_recipients` deja de tener su propia copia de las reglas.
CREATE OR REPLACE FUNCTION public.notify_tramite_recipients(p_ticket_id uuid, p_codigo_tipo text, p_variables jsonb, p_excluir_user_id uuid DEFAULT NULL::uuid, p_adjuntos jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recipient_ids   uuid[];
  v_uid             uuid;
  v_recipient_name  text;
  v_personalized    jsonb;
  v_canales         text[];
  v_tipo            RECORD;
  v_exc             RECORD;
  v_tipo_id         uuid;
  v_tipo_tramite    text;
BEGIN
  v_recipient_ids := resolver_destinatarios_aviso(p_ticket_id, p_codigo_tipo);
  IF array_length(v_recipient_ids, 1) IS NULL THEN RETURN; END IF;

  SELECT enviar_correo, enviar_whatsapp, enviar_notificacion
  INTO v_tipo
  FROM correo_tipos_notificacion WHERE codigo = p_codigo_tipo;

  v_canales := ARRAY[]::text[];
  IF COALESCE(v_tipo.enviar_correo, true)       THEN v_canales := v_canales || ARRAY['email']; END IF;
  IF COALESCE(v_tipo.enviar_whatsapp, true)     THEN v_canales := v_canales || ARRAY['whatsapp']; END IF;
  IF COALESCE(v_tipo.enviar_notificacion, true) THEN v_canales := v_canales || ARRAY['in_app']; END IF;

  -- Excepción por tipo de trámite. La campanita no se configura por tipo: un
  -- aviso dentro de MOVI no molesta a nadie fuera de su pantalla.
  SELECT tipo_tramite INTO v_tipo_tramite FROM tickets WHERE id = p_ticket_id;
  SELECT id INTO v_tipo_id FROM ticket_tipos WHERE value = v_tipo_tramite;

  IF v_tipo_id IS NOT NULL THEN
    SELECT enviar_correo, enviar_whatsapp INTO v_exc
    FROM tramite_tipo_notificacion_canales
    WHERE ticket_tipo_id = v_tipo_id AND codigo = p_codigo_tipo;

    IF FOUND THEN
      v_canales := ARRAY[]::text[];
      IF v_exc.enviar_correo   THEN v_canales := v_canales || ARRAY['email']; END IF;
      IF v_exc.enviar_whatsapp THEN v_canales := v_canales || ARRAY['whatsapp']; END IF;
      IF COALESCE(v_tipo.enviar_notificacion, true) THEN v_canales := v_canales || ARRAY['in_app']; END IF;
    END IF;
  END IF;

  IF array_length(v_canales, 1) IS NULL THEN RETURN; END IF;

  FOREACH v_uid IN ARRAY v_recipient_ids LOOP
    IF p_excluir_user_id IS NOT NULL AND v_uid = p_excluir_user_id THEN
      CONTINUE;
    END IF;

    SELECT nombre_completo INTO v_recipient_name FROM usuarios WHERE id = v_uid;

    v_personalized := p_variables || jsonb_build_object(
      'agente_nombre', COALESCE(v_recipient_name, '')
    );

    PERFORM enviar_notificacion_transaccional(
      p_codigo_tipo     := p_codigo_tipo,
      p_destinatario_id := v_uid,
      p_variables       := v_personalized,
      p_adjuntos        := p_adjuntos,
      p_canales         := v_canales
    );
  END LOOP;
END;
$function$;
