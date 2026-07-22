/*
  # Integrar Agenda con Mi CRM y recordatorios transaccionales

  - Cada reserva confirmada se refleja en dashboard_calendar_events.
  - Se programan recordatorios idempotentes para asesor e invitado.
  - Los canales, plantillas y anticipaciones se administran desde Transaccionales.
  - El procesador SQL corre cada minuto y usa la cola notification_jobs existente.
*/

ALTER TABLE public.correo_tipos_notificacion
  ADD COLUMN IF NOT EXISTS reminder_offsets_minutes integer[] NOT NULL DEFAULT '{}'::integer[];

CREATE TABLE IF NOT EXISTS public.agenda_booking_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.agenda_bookings(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('organizer', 'guest')),
  event_code text NOT NULL,
  offset_minutes integer NOT NULL CHECK (offset_minutes > 0),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'queued', 'cancelled', 'failed')),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, recipient_type, offset_minutes)
);

CREATE INDEX IF NOT EXISTS agenda_booking_reminders_due_idx
  ON public.agenda_booking_reminders (scheduled_for)
  WHERE status = 'pending';

ALTER TABLE public.agenda_booking_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_booking_reminders FROM anon, authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_calendar_agenda_booking_uidx
  ON public.dashboard_calendar_events (usuario_id, entidad_tipo, entidad_id)
  WHERE entidad_tipo = 'agenda_booking';

INSERT INTO public.correo_tipos_notificacion (
  codigo, nombre, descripcion, activo, permite_destinatarios_custom,
  enviar_correo, enviar_whatsapp, enviar_notificacion, modulo,
  trigger_event, destinatario_tipo, platform, reminder_offsets_minutes
)
VALUES
  (
    'agenda_recordatorio_asesor',
    'Agenda — Recordatorio de cita al asesor',
    'Avisa al asesor antes de una cita reservada desde su página pública.',
    true, false, true, true, true, 'CRM',
    'agenda_booking_reminder_organizer', 'usuario_relacionado', 'movi',
    ARRAY[1440, 60]
  ),
  (
    'agenda_recordatorio_invitado',
    'Agenda — Recordatorio de cita al invitado',
    'Envía al invitado recordatorios de su cita con identidad Seguwallet.',
    true, false, true, true, false, 'SEGUWALLET',
    'agenda_booking_reminder_guest', 'usuario_relacionado', 'seguwallet',
    ARRAY[1440, 60]
  )
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  modulo = EXCLUDED.modulo,
  trigger_event = EXCLUDED.trigger_event,
  destinatario_tipo = EXCLUDED.destinatario_tipo,
  platform = EXCLUDED.platform,
  es_obsoleto = false,
  reminder_offsets_minutes = CASE
    WHEN cardinality(correo_tipos_notificacion.reminder_offsets_minutes) = 0
      THEN EXCLUDED.reminder_offsets_minutes
    ELSE correo_tipos_notificacion.reminder_offsets_minutes
  END;

INSERT INTO public.notification_events_catalog (
  event_code, event_name, module, description,
  enable_in_app, enable_email, enable_whatsapp,
  template_in_app, template_email, template_whatsapp,
  priority, active
)
VALUES
  (
    'agenda_recordatorio_asesor',
    'Agenda — Recordatorio de cita al asesor',
    'crm',
    'Recordatorio multicanal para el propietario de la agenda.',
    true, true, true,
    '{"title":"Cita próxima · {{tipo_cita}}","body":"{{invitado_nombre}} te espera {{cuando}} a las {{hora}}.","accion_url":"{{url}}"}',
    '{}', '{}', 'high', true
  ),
  (
    'agenda_recordatorio_invitado',
    'Agenda — Recordatorio de cita al invitado',
    'seguwallet',
    'Recordatorio por correo y WhatsApp para el invitado.',
    false, true, true,
    '{}', '{}', '{}', 'high', true
  )
ON CONFLICT (event_code) DO UPDATE SET
  event_name = EXCLUDED.event_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description,
  active = true,
  updated_at = now();

INSERT INTO public.transactional_notification_templates (
  event_key, name, email_subject_template, email_body_template,
  whatsapp_body_template, inapp_title_template, inapp_body_template,
  is_active, platform
)
VALUES
  (
    'agenda_recordatorio_asesor',
    'Agenda — Recordatorio de cita al asesor',
    'Recordatorio: {{tipo_cita}} con {{invitado_nombre}}',
    '<h2>Tienes una cita próxima</h2><p>Hola {{organizador_nombre}},</p><p><strong>{{tipo_cita}}</strong> con {{invitado_nombre}} está programada para el {{fecha}} a las {{hora}}.</p><p>Modalidad: {{modalidad}}</p><p><a href="{{meeting_url}}">Abrir cita</a></p>',
    '⏰ *Recordatorio de cita*\n\n{{tipo_cita}} con *{{invitado_nombre}}*\n📅 {{fecha}}\n🕐 {{hora}}\n📍 {{modalidad}}\n\n{{meeting_url}}',
    'Cita próxima · {{tipo_cita}}',
    '{{invitado_nombre}} te espera {{cuando}} a las {{hora}}.',
    true, 'movi'
  ),
  (
    'agenda_recordatorio_invitado',
    'Agenda — Recordatorio de cita al invitado',
    'Seguwallet: recordatorio de tu cita con {{organizador_nombre}}',
    '<div style="font-family:Arial,sans-serif"><h2 style="color:#2563eb">Seguwallet</h2><p>Hola {{invitado_nombre}},</p><p>Te recordamos tu cita <strong>{{tipo_cita}}</strong> con {{organizador_nombre}}.</p><p>📅 {{fecha}} · 🕐 {{hora}}<br>📍 {{modalidad}}</p><p><a href="{{meeting_url}}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Abrir cita</a></p></div>',
    '⏰ *Seguwallet · Recordatorio de cita*\n\nHola {{invitado_nombre}}, tu cita *{{tipo_cita}}* con {{organizador_nombre}} es el {{fecha}} a las {{hora}}.\n📍 {{modalidad}}\n\n{{meeting_url}}',
    '', '',
    true, 'seguwallet'
  )
ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = true,
  platform = EXCLUDED.platform,
  updated_at = now();

INSERT INTO public.correo_plantillas (
  tipo_notificacion_id, asunto, html_cuerpo, whatsapp_plantilla,
  notificacion_titulo, notificacion_cuerpo,
  variables_disponibles, whatsapp_variables_disponibles,
  notificacion_variables_disponibles, es_plantilla_default
)
SELECT
  t.id,
  CASE t.codigo
    WHEN 'agenda_recordatorio_asesor' THEN 'Recordatorio: {{tipo_cita}} con {{invitado_nombre}}'
    ELSE 'Seguwallet: recordatorio de tu cita con {{organizador_nombre}}'
  END,
  CASE t.codigo
    WHEN 'agenda_recordatorio_asesor' THEN '<h2>Tienes una cita próxima</h2><p>Hola {{organizador_nombre}},</p><p><strong>{{tipo_cita}}</strong> con {{invitado_nombre}} está programada para el {{fecha}} a las {{hora}}.</p><p>Modalidad: {{modalidad}}</p><p><a href="{{meeting_url}}">Abrir cita</a></p>'
    ELSE '<div style="font-family:Arial,sans-serif"><h2 style="color:#2563eb">Seguwallet</h2><p>Hola {{invitado_nombre}},</p><p>Te recordamos tu cita <strong>{{tipo_cita}}</strong> con {{organizador_nombre}}.</p><p>📅 {{fecha}} · 🕐 {{hora}}<br>📍 {{modalidad}}</p><p><a href="{{meeting_url}}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Abrir cita</a></p></div>'
  END,
  CASE t.codigo
    WHEN 'agenda_recordatorio_asesor' THEN '⏰ *Recordatorio de cita*\n\n{{tipo_cita}} con *{{invitado_nombre}}*\n📅 {{fecha}}\n🕐 {{hora}}\n📍 {{modalidad}}\n\n{{meeting_url}}'
    ELSE '⏰ *Seguwallet · Recordatorio de cita*\n\nHola {{invitado_nombre}}, tu cita *{{tipo_cita}}* con {{organizador_nombre}} es el {{fecha}} a las {{hora}}.\n📍 {{modalidad}}\n\n{{meeting_url}}'
  END,
  CASE WHEN t.codigo = 'agenda_recordatorio_asesor' THEN 'Cita próxima · {{tipo_cita}}' END,
  CASE WHEN t.codigo = 'agenda_recordatorio_asesor' THEN '{{invitado_nombre}} te espera {{cuando}} a las {{hora}}.' END,
  ARRAY['{{organizador_nombre}}','{{invitado_nombre}}','{{tipo_cita}}','{{fecha}}','{{hora}}','{{cuando}}','{{modalidad}}','{{meeting_url}}','{{url}}'],
  ARRAY['{{organizador_nombre}}','{{invitado_nombre}}','{{tipo_cita}}','{{fecha}}','{{hora}}','{{cuando}}','{{modalidad}}','{{meeting_url}}'],
  ARRAY['{{invitado_nombre}}','{{tipo_cita}}','{{hora}}','{{cuando}}','{{url}}'],
  true
FROM public.correo_tipos_notificacion t
WHERE t.codigo IN ('agenda_recordatorio_asesor', 'agenda_recordatorio_invitado')
  AND NOT EXISTS (
    SELECT 1 FROM public.correo_plantillas p WHERE p.tipo_notificacion_id = t.id
  );

CREATE OR REPLACE FUNCTION public.sync_agenda_booking_to_crm_and_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_event_name text;
  v_color text;
  v_offset integer;
  v_event_code text;
  v_recipient text;
BEGIN
  SELECT c.user_id, et.name, et.color
  INTO v_owner_id, v_event_name, v_color
  FROM agenda_event_types et
  JOIN agenda_calendars c ON c.id = et.calendar_id
  WHERE et.id = NEW.event_type_id;

  IF NEW.status = 'confirmed' THEN
    INSERT INTO dashboard_calendar_events (
      usuario_id, titulo, descripcion, fecha_inicio, fecha_fin,
      todo_el_dia, tipo_evento, color, entidad_tipo, entidad_id, metadata
    )
    VALUES (
      v_owner_id,
      v_event_name || ' · ' || NEW.guest_name,
      'Cita reservada desde Agenda',
      NEW.start_at, NEW.end_at, false, 'reserva', COALESCE(v_color, '#2563eb'),
      'agenda_booking', NEW.id,
      jsonb_build_object(
        'guest_name', NEW.guest_name,
        'guest_email', NEW.guest_email,
        'guest_phone', NEW.guest_phone,
        'location_type', NEW.location_type,
        'meeting_url', NEW.meeting_url,
        'agenda_event_type_id', NEW.event_type_id
      )
    )
    ON CONFLICT (usuario_id, entidad_tipo, entidad_id)
      WHERE entidad_tipo = 'agenda_booking'
    DO UPDATE SET
      titulo = EXCLUDED.titulo,
      fecha_inicio = EXCLUDED.fecha_inicio,
      fecha_fin = EXCLUDED.fecha_fin,
      metadata = EXCLUDED.metadata,
      actualizado_en = now();

    FOR v_recipient, v_event_code IN
      SELECT * FROM (VALUES
        ('organizer'::text, 'agenda_recordatorio_asesor'::text),
        ('guest'::text, 'agenda_recordatorio_invitado'::text)
      ) AS recipients(recipient_type, event_code)
    LOOP
      FOR v_offset IN
        SELECT unnest(COALESCE(
          (SELECT reminder_offsets_minutes
           FROM correo_tipos_notificacion
           WHERE codigo = v_event_code AND activo),
          '{}'::integer[]
        ))
      LOOP
        INSERT INTO agenda_booking_reminders (
          booking_id, recipient_type, event_code, offset_minutes, scheduled_for
        )
        VALUES (
          NEW.id, v_recipient, v_event_code, v_offset,
          GREATEST(now(), NEW.start_at - make_interval(mins => v_offset))
        )
        ON CONFLICT (booking_id, recipient_type, offset_minutes)
        DO UPDATE SET
          event_code = EXCLUDED.event_code,
          scheduled_for = EXCLUDED.scheduled_for,
          status = CASE
            WHEN agenda_booking_reminders.status = 'queued' THEN 'queued'
            ELSE 'pending'
          END,
          updated_at = now();
      END LOOP;
    END LOOP;
  ELSE
    UPDATE agenda_booking_reminders
    SET status = 'cancelled', updated_at = now()
    WHERE booking_id = NEW.id AND status IN ('pending', 'processing');

    DELETE FROM dashboard_calendar_events
    WHERE entidad_tipo = 'agenda_booking' AND entidad_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_agenda_booking_to_crm_and_reminders() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_agenda_booking_crm_reminders ON public.agenda_bookings;
CREATE TRIGGER trg_agenda_booking_crm_reminders
AFTER INSERT OR UPDATE OF start_at, end_at, status, guest_name, guest_email,
  guest_phone, location_type, meeting_url
ON public.agenda_bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_agenda_booking_to_crm_and_reminders();

CREATE OR REPLACE FUNCTION public.process_due_agenda_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reminder record;
  v_payload jsonb;
  v_channel text;
  v_enabled boolean;
  v_created integer := 0;
  v_failed integer := 0;
BEGIN
  FOR v_reminder IN
    SELECT
      r.*,
      b.guest_name, b.guest_email, b.guest_phone, b.location_type,
      b.meeting_url, b.start_at, b.end_at,
      et.name AS event_name,
      c.user_id AS owner_id, c.timezone,
      COALESCE(u.nombre_publico, u.nombre_completo, u.nombre, 'Asesor') AS owner_name
    FROM agenda_booking_reminders r
    JOIN agenda_bookings b ON b.id = r.booking_id AND b.status = 'confirmed'
    JOIN agenda_event_types et ON et.id = b.event_type_id
    JOIN agenda_calendars c ON c.id = et.calendar_id
    JOIN usuarios u ON u.id = c.user_id
    WHERE r.status = 'pending'
      AND r.scheduled_for <= now()
      AND b.start_at > now()
    ORDER BY r.scheduled_for
    LIMIT 100
    FOR UPDATE OF r SKIP LOCKED
  LOOP
    BEGIN
      UPDATE agenda_booking_reminders
      SET status = 'processing', updated_at = now()
      WHERE id = v_reminder.id;

      v_payload := jsonb_build_object(
        'organizador_nombre', v_reminder.owner_name,
        'invitado_nombre', v_reminder.guest_name,
        'tipo_cita', v_reminder.event_name,
        'fecha', to_char(v_reminder.start_at AT TIME ZONE v_reminder.timezone, 'DD/MM/YYYY'),
        'hora', to_char(v_reminder.start_at AT TIME ZONE v_reminder.timezone, 'HH12:MI AM'),
        'cuando', CASE
          WHEN v_reminder.offset_minutes >= 1440 THEN 'mañana'
          WHEN v_reminder.offset_minutes >= 60 THEN 'en ' || (v_reminder.offset_minutes / 60)::text || ' hora(s)'
          ELSE 'en ' || v_reminder.offset_minutes::text || ' minutos'
        END,
        'modalidad', CASE v_reminder.location_type
          WHEN 'jitsi' THEN 'Videollamada'
          WHEN 'google_meet' THEN 'Google Meet'
          WHEN 'phone' THEN 'Llamada telefónica'
          ELSE 'Presencial'
        END,
        'meeting_url', COALESCE(v_reminder.meeting_url, 'https://app.movi.digital/agenda'),
        'url', '/agenda',
        'email', CASE WHEN v_reminder.recipient_type = 'guest' THEN v_reminder.guest_email ELSE NULL END,
        'phone', CASE WHEN v_reminder.recipient_type = 'guest' THEN v_reminder.guest_phone ELSE NULL END,
        'nombre_usuario', CASE WHEN v_reminder.recipient_type = 'guest' THEN v_reminder.guest_name ELSE v_reminder.owner_name END
      );

      FOR v_channel IN SELECT unnest(ARRAY['in_app','email','whatsapp'])
      LOOP
        SELECT CASE v_channel
          WHEN 'in_app' THEN enable_in_app
          WHEN 'email' THEN enable_email
          ELSE enable_whatsapp
        END
        INTO v_enabled
        FROM notification_events_catalog
        WHERE event_code = v_reminder.event_code AND active;

        IF COALESCE(v_enabled, false)
          AND NOT (v_reminder.recipient_type = 'guest' AND v_channel = 'in_app')
          AND NOT (v_reminder.recipient_type = 'guest' AND v_channel = 'email' AND COALESCE(v_reminder.guest_email, '') = '')
          AND NOT (v_reminder.recipient_type = 'guest' AND v_channel = 'whatsapp' AND COALESCE(v_reminder.guest_phone, '') = '')
        THEN
          INSERT INTO notification_jobs (
            event_code, user_id, channel, status, payload,
            idempotency_key, attempt_count, max_attempts
          )
          VALUES (
            v_reminder.event_code, v_reminder.owner_id, v_channel, 'pending', v_payload,
            'agenda_' || v_reminder.booking_id::text || '_' ||
              v_reminder.recipient_type || '_' || v_reminder.offset_minutes::text ||
              '_' || v_channel,
            0, 3
          )
          ON CONFLICT (idempotency_key) DO NOTHING;
          v_created := v_created + 1;
        END IF;
      END LOOP;

      UPDATE agenda_booking_reminders
      SET status = 'queued', processed_at = now(), updated_at = now()
      WHERE id = v_reminder.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE agenda_booking_reminders
      SET status = 'failed', last_error = SQLERRM, updated_at = now()
      WHERE id = v_reminder.id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'jobs_created', v_created, 'failed', v_failed);
END;
$$;

REVOKE ALL ON FUNCTION public.process_due_agenda_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_due_agenda_reminders() TO service_role;

-- Reflejar reservas futuras creadas antes de esta migración.
INSERT INTO public.dashboard_calendar_events (
  usuario_id, titulo, descripcion, fecha_inicio, fecha_fin, todo_el_dia,
  tipo_evento, color, entidad_tipo, entidad_id, metadata
)
SELECT
  c.user_id, et.name || ' · ' || b.guest_name, 'Cita reservada desde Agenda',
  b.start_at, b.end_at, false, 'reserva', et.color, 'agenda_booking', b.id,
  jsonb_build_object(
    'guest_name', b.guest_name, 'guest_email', b.guest_email,
    'guest_phone', b.guest_phone, 'location_type', b.location_type,
    'meeting_url', b.meeting_url, 'agenda_event_type_id', b.event_type_id
  )
FROM public.agenda_bookings b
JOIN public.agenda_event_types et ON et.id = b.event_type_id
JOIN public.agenda_calendars c ON c.id = et.calendar_id
WHERE b.status = 'confirmed' AND b.end_at > now()
ON CONFLICT (usuario_id, entidad_tipo, entidad_id)
  WHERE entidad_tipo = 'agenda_booking'
DO NOTHING;

INSERT INTO public.agenda_booking_reminders (
  booking_id, recipient_type, event_code, offset_minutes, scheduled_for
)
SELECT
  b.id, cfg.recipient_type, cfg.event_code, offsets.offset_minutes,
  GREATEST(now(), b.start_at - make_interval(mins => offsets.offset_minutes))
FROM public.agenda_bookings b
CROSS JOIN (
  VALUES
    ('organizer'::text, 'agenda_recordatorio_asesor'::text),
    ('guest'::text, 'agenda_recordatorio_invitado'::text)
) cfg(recipient_type, event_code)
JOIN public.correo_tipos_notificacion t
  ON t.codigo = cfg.event_code AND t.activo
CROSS JOIN LATERAL unnest(t.reminder_offsets_minutes) offsets(offset_minutes)
WHERE b.status = 'confirmed' AND b.start_at > now()
ON CONFLICT (booking_id, recipient_type, offset_minutes) DO NOTHING;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'process-agenda-reminders';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
  PERFORM cron.schedule(
    'process-agenda-reminders',
    '* * * * *',
    'select public.process_due_agenda_reminders();'
  );
END;
$$;
