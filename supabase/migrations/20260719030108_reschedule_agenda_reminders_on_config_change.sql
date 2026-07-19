CREATE OR REPLACE FUNCTION public.reschedule_agenda_reminders_on_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_type text;
BEGIN
  IF NEW.codigo NOT IN ('agenda_recordatorio_asesor', 'agenda_recordatorio_invitado') THEN
    RETURN NEW;
  END IF;

  v_recipient_type := CASE
    WHEN NEW.codigo = 'agenda_recordatorio_asesor' THEN 'organizer'
    ELSE 'guest'
  END;

  DELETE FROM agenda_booking_reminders r
  USING agenda_bookings b
  WHERE r.booking_id = b.id
    AND r.event_code = NEW.codigo
    AND r.status IN ('pending', 'failed', 'cancelled')
    AND b.status = 'confirmed'
    AND b.start_at > now();

  IF NEW.activo THEN
    INSERT INTO agenda_booking_reminders (
      booking_id, recipient_type, event_code, offset_minutes, scheduled_for
    )
    SELECT
      b.id,
      v_recipient_type,
      NEW.codigo,
      offsets.offset_minutes,
      GREATEST(now(), b.start_at - make_interval(mins => offsets.offset_minutes))
    FROM agenda_bookings b
    CROSS JOIN LATERAL unnest(NEW.reminder_offsets_minutes) offsets(offset_minutes)
    WHERE b.status = 'confirmed' AND b.start_at > now()
    ON CONFLICT (booking_id, recipient_type, offset_minutes) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_agenda_reminders_on_config_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_reschedule_agenda_reminders_on_config
  ON public.correo_tipos_notificacion;
CREATE TRIGGER trg_reschedule_agenda_reminders_on_config
AFTER UPDATE OF reminder_offsets_minutes, activo
ON public.correo_tipos_notificacion
FOR EACH ROW
WHEN (
  OLD.reminder_offsets_minutes IS DISTINCT FROM NEW.reminder_offsets_minutes
  OR OLD.activo IS DISTINCT FROM NEW.activo
)
EXECUTE FUNCTION public.reschedule_agenda_reminders_on_config_change();
