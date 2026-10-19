-- Fase 1 de un solo motor: UNA sola tabla de plantillas
-- =====================================================
--
-- Hoy hay dos, y las dos están vivas:
--   · `transactional_notification_templates` — la leen las edge functions y
--     `send_transactional_notification`.
--   · `correo_plantillas` — la lee `enviar_notificacion_transaccional`, por
--     donde salen los avisos que disparan los triggers de la base.
--
-- Por eso el editor de plantillas tiene que escribir en las dos, y por eso un
-- mismo aviso puede tener dos textos distintos sin que nadie lo note.
--
-- Al terminar esta migración, `correo_plantillas` queda SOLO como respaldo
-- histórico: nadie la lee.
--
-- Regla al juntarlas (decisión de Ricardo): **gana la que se está usando**.
-- Nadie debe notar un cambio de texto el día que esto corra.

-- ── 1. Lo que solo existe en la tabla vieja se copia tal cual ───────────────
INSERT INTO public.transactional_notification_templates (
  event_key, name, platform, is_active,
  email_subject_template, email_body_template,
  whatsapp_body_template, inapp_title_template, inapp_body_template
)
SELECT
  t.codigo,
  t.nombre,
  COALESCE(t.platform, 'movi'),
  COALESCE(t.activo, true),
  p.asunto,
  p.html_cuerpo,
  p.whatsapp_plantilla,
  p.notificacion_titulo,
  p.notificacion_cuerpo
FROM public.correo_plantillas p
JOIN public.correo_tipos_notificacion t ON t.id = p.tipo_notificacion_id
WHERE COALESCE(p.es_plantilla_default, true)
  AND NOT EXISTS (
    SELECT 1 FROM public.transactional_notification_templates n
    WHERE n.event_key = t.codigo
  );

-- ── 2. Los avisos que HOY salen por el camino SQL mandan su texto ──────────
--
-- Estos seis los disparan triggers de la base, así que el texto que la gente
-- recibe es el de `correo_plantillas`. Si se dejara ganar a la tabla nueva,
-- cambiarían de golpe mensajes que llevan meses saliendo bien.
--
-- `tramite_documento_cargado` NO está en la lista a propósito: ese sale por
-- los dos caminos, y el del frontend (adjuntos, candado, confirmación) usa la
-- tabla nueva. Ahí gana la nueva, y es el único aviso cuyo texto puede
-- cambiar con esta migración.
UPDATE public.transactional_notification_templates n
SET
  email_subject_template = COALESCE(p.asunto, n.email_subject_template),
  email_body_template    = COALESCE(p.html_cuerpo, n.email_body_template),
  whatsapp_body_template = COALESCE(p.whatsapp_plantilla, n.whatsapp_body_template),
  inapp_title_template   = COALESCE(p.notificacion_titulo, n.inapp_title_template),
  inapp_body_template    = COALESCE(p.notificacion_cuerpo, n.inapp_body_template),
  updated_at             = now()
FROM public.correo_plantillas p
JOIN public.correo_tipos_notificacion t ON t.id = p.tipo_notificacion_id
WHERE n.event_key = t.codigo
  AND COALESCE(p.es_plantilla_default, true)
  AND t.codigo IN (
    'tramite_cambio_estatus',
    'tramite_comentario_nuevo',
    'tramite_actualizado',
    'admin_digital_batch_guardado',
    'web_monitor_status_change'
  );

-- ── 3. El motor SQL lee la tabla única ─────────────────────────────────────
--
-- Solo cambia de dónde salen las plantillas; los canales ya venían de
-- `correo_tipos_notificacion` desde la migración anterior.
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
n.email_subject_template as asunto,
n.email_body_template as html_cuerpo,
n.whatsapp_body_template as whatsapp_plantilla,
COALESCE(t.enviar_correo, true) as enviar_correo,
COALESCE(t.enviar_whatsapp, true) as enviar_whatsapp,
COALESCE(t.enviar_notificacion, true) as enviar_notificacion
INTO v_template
FROM correo_tipos_notificacion t
LEFT JOIN transactional_notification_templates n ON n.event_key = t.codigo
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

COMMENT ON TABLE public.correo_plantillas IS
  'DEPRECADA (2026-10-19): nadie la lee. Las plantillas viven en transactional_notification_templates. Se conserva como respaldo del texto anterior a la unificación.';
