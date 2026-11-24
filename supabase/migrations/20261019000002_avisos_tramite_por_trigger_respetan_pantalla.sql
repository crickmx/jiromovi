-- Los avisos de trámite que salen por trigger respetan la pantalla
-- ================================================================
--
-- Cuatro de los seis avisos de Trámites NO salen por las edge functions: los
-- disparan triggers de la base (comentario nuevo, cambio de estatus, trámite
-- actualizado, documento cargado) y van por otro camino:
--
--   trigger → notify_tramite_recipients → enviar_notificacion_transaccional
--           → notification_jobs → cron `notification-dispatcher`
--
-- Ese camino ignoraba por completo lo que se configura en Admin ›
-- Transaccionales:
--
--   · Los canales salían de `correo_plantillas.enviar_*`, no de
--     `correo_tipos_notificacion.enviar_*`, que es lo que la pantalla edita.
--     O sea que apagar "Correo" ahí no apagaba nada para estos cuatro.
--   · Los destinatarios estaban fijos en el código SQL: agente + responsable.
--     El selector "¿A quién se le avisa?" del 16/10 no les aplicaba.
--   · Las excepciones por tipo de trámite tampoco.
--
-- Con esto, los dos motores obedecen la MISMA configuración. Las reglas de
-- destinatarios son las mismas que `src/lib/destinatariosAviso.ts` — si una
-- cambia, hay que cambiar la otra o los dos caminos empiezan a avisar distinto.

DROP FUNCTION IF EXISTS public.enviar_notificacion_transaccional(text, uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.enviar_notificacion_transaccional(p_codigo_tipo text, p_destinatario_id uuid, p_variables jsonb DEFAULT '{}'::jsonb, p_adjuntos jsonb DEFAULT NULL::jsonb, p_canales text[] DEFAULT NULL::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_template record;
v_destinatario record;
v_channels text[];
v_idem_base text;
BEGIN
SELECT 
id,
nombre_completo,
email_laboral,
celular_laboral
INTO v_destinatario
FROM usuarios
WHERE id = p_destinatario_id
AND deleted_at IS NULL
AND estado != 'eliminado';

IF NOT FOUND THEN
RAISE WARNING '[NOTIF TRANSACCIONAL] Destinatario no encontrado o inactivo: %', p_destinatario_id;
RETURN;
END IF;

SELECT
t.codigo,
t.nombre as tipo_nombre,
p.asunto,
p.html_cuerpo,
p.whatsapp_plantilla,
COALESCE(t.enviar_correo, true) as enviar_correo,
COALESCE(t.enviar_whatsapp, true) as enviar_whatsapp,
COALESCE(t.enviar_notificacion, true) as enviar_notificacion
INTO v_template
FROM correo_tipos_notificacion t
LEFT JOIN correo_plantillas p ON p.tipo_notificacion_id = t.id AND p.es_plantilla_default = true
WHERE t.codigo = p_codigo_tipo
AND t.activo = true;

IF NOT FOUND THEN
RAISE WARNING '[NOTIF TRANSACCIONAL] Tipo de notificación no encontrado o inactivo: %', p_codigo_tipo;
RETURN;
END IF;

-- Los canales que imponga quien llama ganan: así la excepción por tipo de
-- trámite (tramite_tipo_notificacion_canales) puede apagar un canal para un
-- tipo sin tocar la configuración del evento.
IF p_canales IS NOT NULL THEN
v_channels := p_canales;
ELSE
v_channels := ARRAY[]::text[];
IF v_template.enviar_correo THEN
v_channels := v_channels || ARRAY['email'];
END IF;
IF v_template.enviar_whatsapp THEN
v_channels := v_channels || ARRAY['whatsapp'];
END IF;
IF v_template.enviar_notificacion THEN
v_channels := v_channels || ARRAY['in_app'];
END IF;

IF array_length(v_channels, 1) IS NULL THEN
v_channels := ARRAY['email', 'whatsapp', 'in_app'];
END IF;
END IF;

v_idem_base := p_codigo_tipo || '_' || p_destinatario_id::text || '_' || to_char(date_trunc('minute', now()), 'YYYYMMDD_HH24MI');

IF 'email' = ANY(v_channels) AND v_destinatario.email_laboral IS NOT NULL THEN
INSERT INTO notification_jobs (
event_code,
user_id,
channel,
payload,
attachments,
status,
idempotency_key
) VALUES (
p_codigo_tipo,
p_destinatario_id,
'email',
p_variables || jsonb_build_object(
'email', v_destinatario.email_laboral,
'nombre_completo', v_destinatario.nombre_completo
),
p_adjuntos,
'pending',
v_idem_base || '_email'
)
ON CONFLICT (idempotency_key) DO NOTHING;

RAISE NOTICE '[NOTIF TRANSACCIONAL] Email job creado para % (adjuntos: %)', 
v_destinatario.email_laboral, 
CASE WHEN p_adjuntos IS NOT NULL THEN jsonb_array_length(p_adjuntos) ELSE 0 END;
END IF;

IF 'whatsapp' = ANY(v_channels) AND v_destinatario.celular_laboral IS NOT NULL THEN
INSERT INTO notification_jobs (
event_code,
user_id,
channel,
payload,
status,
idempotency_key
) VALUES (
p_codigo_tipo,
p_destinatario_id,
'whatsapp',
p_variables || jsonb_build_object(
'phone', v_destinatario.celular_laboral,
'nombre_completo', v_destinatario.nombre_completo
),
'pending',
v_idem_base || '_whatsapp'
)
ON CONFLICT (idempotency_key) DO NOTHING;

RAISE NOTICE '[NOTIF TRANSACCIONAL] WhatsApp job creado para %', v_destinatario.celular_laboral;
END IF;

IF 'in_app' = ANY(v_channels) THEN
INSERT INTO notification_jobs (
event_code,
user_id,
channel,
payload,
status,
idempotency_key
) VALUES (
p_codigo_tipo,
p_destinatario_id,
'in_app',
p_variables || jsonb_build_object(
'nombre_completo', v_destinatario.nombre_completo
),
'pending',
v_idem_base || '_in_app'
)
ON CONFLICT (idempotency_key) DO NOTHING;

RAISE NOTICE '[NOTIF TRANSACCIONAL] In-app job creado';
END IF;

END;
$function$
;
-- Quién recibe: lo que diga `destinatarios_roles`, con las mismas reglas que
-- el frontend — el líder es RESPALDO (solo si no hay responsable), nadie se
-- repite, y sin roles configurados se usa el comportamiento de siempre
-- (solicitante + responsable), que es lo que esta función hacía fijo.
CREATE OR REPLACE FUNCTION public.notify_tramite_recipients(p_ticket_id uuid, p_codigo_tipo text, p_variables jsonb, p_excluir_user_id uuid DEFAULT NULL::uuid, p_adjuntos jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_t               RECORD;
  v_tipo            RECORD;
  v_roles           text[];
  v_recipient_ids   uuid[];
  v_uid             uuid;
  v_lider           uuid;
  v_recipient_name  text;
  v_personalized    jsonb;
  v_canales         text[];
  v_exc             RECORD;
  v_tipo_id         uuid;
BEGIN
  SELECT agente_id, assigned_to_user_id, grupo_asignado_id, tipo_tramite
  INTO v_t
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT id, destinatarios_roles, enviar_correo, enviar_whatsapp, enviar_notificacion
  INTO v_tipo
  FROM correo_tipos_notificacion
  WHERE codigo = p_codigo_tipo;

  v_roles := COALESCE(v_tipo.destinatarios_roles, ARRAY[]::text[]);
  v_recipient_ids := ARRAY[]::uuid[];

  IF array_length(v_roles, 1) IS NULL THEN
    -- Sin configurar: lo de siempre. Una configuración en blanco nunca debe
    -- significar "no avisarle a nadie".
    IF v_t.agente_id IS NOT NULL THEN
      v_recipient_ids := array_append(v_recipient_ids, v_t.agente_id);
    END IF;
    IF v_t.assigned_to_user_id IS NOT NULL THEN
      v_recipient_ids := array_append(v_recipient_ids, v_t.assigned_to_user_id);
    END IF;
  ELSE
    IF 'solicitante' = ANY(v_roles) AND v_t.agente_id IS NOT NULL THEN
      v_recipient_ids := array_append(v_recipient_ids, v_t.agente_id);
    END IF;

    IF 'responsable' = ANY(v_roles) AND v_t.assigned_to_user_id IS NOT NULL THEN
      v_recipient_ids := array_append(v_recipient_ids, v_t.assigned_to_user_id);
    END IF;

    -- El líder es respaldo, no un segundo destinatario: con responsable puesto
    -- no entra, o al jefe le llegaría todo y dejaría de leerlo.
    IF 'lider_equipo' = ANY(v_roles)
       AND v_t.assigned_to_user_id IS NULL
       AND v_t.grupo_asignado_id IS NOT NULL THEN
      SELECT usuario_id INTO v_lider
      FROM tramites_grupos_miembros
      WHERE grupo_id = v_t.grupo_asignado_id
        AND rol_en_equipo IN ('lider', 'supervisor', 'director')
      ORDER BY CASE rol_en_equipo WHEN 'lider' THEN 1 WHEN 'supervisor' THEN 2 ELSE 3 END
      LIMIT 1;
      IF v_lider IS NOT NULL THEN
        v_recipient_ids := array_append(v_recipient_ids, v_lider);
      END IF;
    END IF;

    IF 'lista_fija' = ANY(v_roles) AND v_tipo.id IS NOT NULL THEN
      SELECT array_agg(usuario_id) INTO v_recipient_ids
      FROM (
        SELECT unnest(v_recipient_ids) AS usuario_id
        UNION
        SELECT usuario_id FROM correo_destinatarios_notificacion
        WHERE tipo_notificacion_id = v_tipo.id
      ) q;
    END IF;
  END IF;

  -- Sin nadie a quien avisar no hay nada que hacer.
  IF array_length(v_recipient_ids, 1) IS NULL THEN RETURN; END IF;

  -- Canales: los del evento, y encima la excepción del tipo de trámite.
  v_canales := ARRAY[]::text[];
  IF COALESCE(v_tipo.enviar_correo, true)       THEN v_canales := v_canales || ARRAY['email']; END IF;
  IF COALESCE(v_tipo.enviar_whatsapp, true)     THEN v_canales := v_canales || ARRAY['whatsapp']; END IF;
  IF COALESCE(v_tipo.enviar_notificacion, true) THEN v_canales := v_canales || ARRAY['in_app']; END IF;

  SELECT id INTO v_tipo_id FROM ticket_tipos WHERE value = v_t.tipo_tramite;
  IF v_tipo_id IS NOT NULL THEN
    SELECT enviar_correo, enviar_whatsapp INTO v_exc
    FROM tramite_tipo_notificacion_canales
    WHERE ticket_tipo_id = v_tipo_id AND codigo = p_codigo_tipo;

    IF FOUND THEN
      -- La campanita no se configura por tipo: un aviso dentro de MOVI no
      -- molesta a nadie fuera de su pantalla.
      v_canales := ARRAY[]::text[];
      IF v_exc.enviar_correo   THEN v_canales := v_canales || ARRAY['email']; END IF;
      IF v_exc.enviar_whatsapp THEN v_canales := v_canales || ARRAY['whatsapp']; END IF;
      IF COALESCE(v_tipo.enviar_notificacion, true) THEN v_canales := v_canales || ARRAY['in_app']; END IF;
    END IF;
  END IF;

  IF array_length(v_canales, 1) IS NULL THEN RETURN; END IF;

  -- Una misma persona puede caer en dos papeles (solicitante y responsable);
  -- se le avisa una vez.
  SELECT array_agg(DISTINCT x) INTO v_recipient_ids FROM unnest(v_recipient_ids) x;

  FOREACH v_uid IN ARRAY v_recipient_ids LOOP
    IF p_excluir_user_id IS NOT NULL AND v_uid = p_excluir_user_id THEN
      CONTINUE;
    END IF;

    SELECT nombre_completo INTO v_recipient_name
    FROM usuarios WHERE id = v_uid;

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
