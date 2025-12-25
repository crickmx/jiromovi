/*
  # Sistema de Notificaciones para Reservas de Espacio Jiro

  1. Plantillas de Notificación
    - space_reservation_created: Cuando se crea una reserva (notifica al gerente)
    - space_reservation_approved: Cuando se aprueba una reserva (notifica al solicitante)
    - space_reservation_rejected: Cuando se rechaza una reserva (notifica al solicitante)

  2. Triggers
    - Después de INSERT en reservas_espacio → notificar al gerente
    - Después de UPDATE en reservas_espacio → notificar al solicitante si cambia el estado

  3. Variables disponibles
    - {{user_name}}: Nombre del usuario que hace la reserva
    - {{area_name}}: Nombre del área reservada
    - {{office_name}}: Nombre de la oficina
    - {{fecha}}: Fecha de la reserva
    - {{hora_inicio}}: Hora de inicio
    - {{hora_fin}}: Hora de fin
    - {{notas}}: Notas de la reserva
    - {{comentarios_gerente}}: Comentarios del gerente (solo en aprobación/rechazo)
    - {{manager_name}}: Nombre del gerente que aprueba/rechaza
*/

-- ============================================
-- Plantilla: Nueva reserva (notificar a gerente)
-- ============================================

INSERT INTO transactional_notification_templates (
  event_key,
  name,
  email_subject_template,
  email_body_template,
  whatsapp_body_template,
  inapp_title_template,
  inapp_body_template,
  is_active
) VALUES (
  'space_reservation_created',
  'Nueva Reserva de Espacio - Notificación a Gerente',
  'Nueva reserva pendiente de aprobación en {{area_name}}',
  '<p>Hola <strong>{{manager_name}}</strong>,</p>
<br>
<p>Se ha creado una nueva reserva en <strong>{{area_name}}</strong> que requiere tu aprobación.</p>
<br>
<p><strong>Detalles de la reserva:</strong></p>
<ul>
  <li><strong>Solicitante:</strong> {{user_name}}</li>
  <li><strong>Oficina:</strong> {{office_name}}</li>
  <li><strong>Fecha:</strong> {{fecha}}</li>
  <li><strong>Horario:</strong> {{hora_inicio}} - {{hora_fin}}</li>
  <li><strong>Notas:</strong> {{notas}}</li>
</ul>
<br>
<p>Por favor, revisa y procesa esta solicitud en el sistema.</p>
<p><a href="{{link_url}}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver Reserva</a></p>
<br>
<p>Atentamente,<br>
Sistema MOVI Digital</p>',
  'Hola {{manager_name}} 👋

Nueva reserva pendiente de aprobación:

📍 Área: {{area_name}}
🏢 Oficina: {{office_name}}
👤 Solicitante: {{user_name}}
📅 Fecha: {{fecha}}
⏰ Horario: {{hora_inicio}} - {{hora_fin}}
📝 Notas: {{notas}}

Por favor, revisa esta solicitud en el sistema.',
  'Nueva reserva en {{area_name}}',
  '{{user_name}} solicita reservar {{area_name}} el {{fecha}} de {{hora_inicio}} a {{hora_fin}}. Haz clic para revisar.',
  true
) ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  inapp_title_template = EXCLUDED.inapp_title_template,
  inapp_body_template = EXCLUDED.inapp_body_template,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ============================================
-- Plantilla: Reserva aprobada (notificar a usuario)
-- ============================================

INSERT INTO transactional_notification_templates (
  event_key,
  name,
  email_subject_template,
  email_body_template,
  whatsapp_body_template,
  inapp_title_template,
  inapp_body_template,
  is_active
) VALUES (
  'space_reservation_approved',
  'Reserva de Espacio Aprobada - Notificación a Usuario',
  'Tu reserva en {{area_name}} ha sido aprobada',
  '<p>Hola <strong>{{user_name}}</strong>,</p>
<br>
<p>¡Buenas noticias! Tu reserva en <strong>{{area_name}}</strong> ha sido aprobada.</p>
<br>
<p><strong>Detalles de tu reserva:</strong></p>
<ul>
  <li><strong>Oficina:</strong> {{office_name}}</li>
  <li><strong>Fecha:</strong> {{fecha}}</li>
  <li><strong>Horario:</strong> {{hora_inicio}} - {{hora_fin}}</li>
  <li><strong>Aprobada por:</strong> {{manager_name}}</li>
</ul>
<br>
<p>Por favor, asegúrate de estar puntual en la fecha y hora indicadas.</p>
<p><a href="{{link_url}}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Ver Mis Reservas</a></p>
<br>
<p>Atentamente,<br>
Sistema MOVI Digital</p>',
  'Hola {{user_name}} 👋

✅ Tu reserva ha sido APROBADA

📍 Área: {{area_name}}
🏢 Oficina: {{office_name}}
📅 Fecha: {{fecha}}
⏰ Horario: {{hora_inicio}} - {{hora_fin}}
👤 Aprobada por: {{manager_name}}

¡Nos vemos allí!',
  'Reserva aprobada: {{area_name}}',
  'Tu reserva en {{area_name}} para el {{fecha}} de {{hora_inicio}} a {{hora_fin}} ha sido aprobada. Haz clic para ver detalles.',
  true
) ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  inapp_title_template = EXCLUDED.inapp_title_template,
  inapp_body_template = EXCLUDED.inapp_body_template,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ============================================
-- Plantilla: Reserva rechazada (notificar a usuario)
-- ============================================

INSERT INTO transactional_notification_templates (
  event_key,
  name,
  email_subject_template,
  email_body_template,
  whatsapp_body_template,
  inapp_title_template,
  inapp_body_template,
  is_active
) VALUES (
  'space_reservation_rejected',
  'Reserva de Espacio Rechazada - Notificación a Usuario',
  'Tu reserva en {{area_name}} no pudo ser aprobada',
  '<p>Hola <strong>{{user_name}}</strong>,</p>
<br>
<p>Te informamos que tu reserva en <strong>{{area_name}}</strong> no pudo ser aprobada.</p>
<br>
<p><strong>Detalles de la reserva:</strong></p>
<ul>
  <li><strong>Oficina:</strong> {{office_name}}</li>
  <li><strong>Fecha:</strong> {{fecha}}</li>
  <li><strong>Horario:</strong> {{hora_inicio}} - {{hora_fin}}</li>
  <li><strong>Revisada por:</strong> {{manager_name}}</li>
</ul>
<br>
<p>Puedes crear una nueva reserva con diferente fecha/horario si lo deseas.</p>
<p><a href="{{link_url}}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Hacer Nueva Reserva</a></p>
<br>
<p>Atentamente,<br>
Sistema MOVI Digital</p>',
  'Hola {{user_name}} 👋

❌ Tu reserva no pudo ser aprobada

📍 Área: {{area_name}}
🏢 Oficina: {{office_name}}
📅 Fecha: {{fecha}}
⏰ Horario: {{hora_inicio}} - {{hora_fin}}
👤 Revisada por: {{manager_name}}

Puedes hacer una nueva reserva con diferente fecha/horario.',
  'Reserva no aprobada: {{area_name}}',
  'Tu reserva en {{area_name}} para el {{fecha}} no pudo ser aprobada. Haz clic para ver detalles.',
  true
) ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  email_subject_template = EXCLUDED.email_subject_template,
  email_body_template = EXCLUDED.email_body_template,
  whatsapp_body_template = EXCLUDED.whatsapp_body_template,
  inapp_title_template = EXCLUDED.inapp_title_template,
  inapp_body_template = EXCLUDED.inapp_body_template,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ============================================
-- Función: Notificar al gerente cuando se crea una reserva
-- ============================================

CREATE OR REPLACE FUNCTION notify_manager_new_space_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_id uuid;
  v_manager_name text;
  v_user_name text;
  v_area_name text;
  v_office_name text;
  v_fecha_formatted text;
BEGIN
  -- Solo proceder si la reserva se crea en estado pendiente
  IF NEW.estado = 'pendiente' THEN
    -- Obtener el gerente de la oficina
    SELECT u.id, COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos)
    INTO v_manager_id, v_manager_name
    FROM usuarios u
    WHERE u.oficina_id = NEW.oficina_id
      AND u.rol = 'Gerente'
      AND u.activo = true
      AND u.is_deleted = false
    LIMIT 1;

    -- Si no hay gerente, no enviar notificación
    IF v_manager_id IS NULL THEN
      RAISE LOG '[space_reservation] No se encontró gerente activo para la oficina %', NEW.oficina_id;
      RETURN NEW;
    END IF;

    -- Obtener datos adicionales
    SELECT COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos)
    INTO v_user_name
    FROM usuarios u
    WHERE u.id = NEW.usuario_id;

    SELECT a.nombre
    INTO v_area_name
    FROM areas a
    WHERE a.id = NEW.area_id;

    SELECT o.nombre
    INTO v_office_name
    FROM oficinas o
    WHERE o.id = NEW.oficina_id;

    -- Formatear fecha
    v_fecha_formatted := to_char(NEW.fecha, 'DD/MM/YYYY');

    -- Enviar notificación al gerente
    PERFORM send_transactional_notification(
      'space_reservation_created',
      v_manager_id,
      jsonb_build_object(
        'manager_name', v_manager_name,
        'user_name', v_user_name,
        'area_name', v_area_name,
        'office_name', v_office_name,
        'fecha', v_fecha_formatted,
        'hora_inicio', to_char(NEW.hora_inicio, 'HH24:MI'),
        'hora_fin', to_char(NEW.hora_fin, 'HH24:MI'),
        'notas', COALESCE(NEW.notas, 'Sin notas adicionales'),
        'link_url', '/espacio-jiro'
      ),
      '/espacio-jiro'
    );

    RAISE LOG '[space_reservation] Notificación enviada al gerente % para reserva %', v_manager_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- Función: Notificar al usuario cuando cambia el estado de su reserva
-- ============================================

CREATE OR REPLACE FUNCTION notify_user_space_reservation_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_key text;
  v_user_name text;
  v_area_name text;
  v_office_name text;
  v_manager_name text;
  v_fecha_formatted text;
BEGIN
  -- Solo proceder si cambió el estado y es aprobada o rechazada
  IF OLD.estado != NEW.estado AND NEW.estado IN ('aprobada', 'rechazada') THEN

    -- Determinar el evento según el nuevo estado
    IF NEW.estado = 'aprobada' THEN
      v_event_key := 'space_reservation_approved';
    ELSIF NEW.estado = 'rechazada' THEN
      v_event_key := 'space_reservation_rejected';
    END IF;

    -- Obtener datos del usuario que hizo la reserva
    SELECT COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos)
    INTO v_user_name
    FROM usuarios u
    WHERE u.id = NEW.usuario_id;

    -- Obtener nombre del área
    SELECT a.nombre
    INTO v_area_name
    FROM areas a
    WHERE a.id = NEW.area_id;

    -- Obtener nombre de la oficina
    SELECT o.nombre
    INTO v_office_name
    FROM oficinas o
    WHERE o.id = NEW.oficina_id;

    -- Obtener nombre del gerente (asumimos que auth.uid() es el gerente que aprueba/rechaza)
    SELECT COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos)
    INTO v_manager_name
    FROM usuarios u
    WHERE u.id = auth.uid();

    -- Si no se pudo obtener el gerente del contexto, usar el gerente de la oficina
    IF v_manager_name IS NULL THEN
      SELECT COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos)
      INTO v_manager_name
      FROM usuarios u
      WHERE u.oficina_id = NEW.oficina_id
        AND u.rol = 'Gerente'
        AND u.activo = true
        AND u.is_deleted = false
      LIMIT 1;
    END IF;

    -- Formatear fecha
    v_fecha_formatted := to_char(NEW.fecha, 'DD/MM/YYYY');

    -- Enviar notificación al usuario
    PERFORM send_transactional_notification(
      v_event_key,
      NEW.usuario_id,
      jsonb_build_object(
        'user_name', v_user_name,
        'area_name', v_area_name,
        'office_name', v_office_name,
        'fecha', v_fecha_formatted,
        'hora_inicio', to_char(NEW.hora_inicio, 'HH24:MI'),
        'hora_fin', to_char(NEW.hora_fin, 'HH24:MI'),
        'manager_name', COALESCE(v_manager_name, 'Gerencia'),
        'comentarios_gerente', COALESCE(NEW.comentarios_gerente, ''),
        'link_url', '/espacio-jiro'
      ),
      '/espacio-jiro'
    );

    RAISE LOG '[space_reservation] Notificación % enviada al usuario % para reserva %', v_event_key, NEW.usuario_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- Triggers
-- ============================================

-- Trigger para notificar al gerente cuando se crea una nueva reserva
DROP TRIGGER IF EXISTS trigger_notify_manager_new_reservation ON reservas_espacio;
CREATE TRIGGER trigger_notify_manager_new_reservation
  AFTER INSERT ON reservas_espacio
  FOR EACH ROW
  WHEN (NEW.estado = 'pendiente')
  EXECUTE FUNCTION notify_manager_new_space_reservation();

-- Trigger para notificar al usuario cuando cambia el estado de su reserva
DROP TRIGGER IF EXISTS trigger_notify_user_reservation_status ON reservas_espacio;
CREATE TRIGGER trigger_notify_user_reservation_status
  AFTER UPDATE ON reservas_espacio
  FOR EACH ROW
  WHEN (OLD.estado != NEW.estado AND NEW.estado IN ('aprobada', 'rechazada'))
  EXECUTE FUNCTION notify_user_space_reservation_status();

-- Comentarios
COMMENT ON FUNCTION notify_manager_new_space_reservation() IS
  'Envía notificación al gerente de la oficina cuando se crea una nueva reserva pendiente';
COMMENT ON FUNCTION notify_user_space_reservation_status() IS
  'Envía notificación al usuario cuando su reserva es aprobada o rechazada';
COMMENT ON TRIGGER trigger_notify_manager_new_reservation ON reservas_espacio IS
  'Notifica al gerente cuando se crea una nueva reserva pendiente';
COMMENT ON TRIGGER trigger_notify_user_reservation_status ON reservas_espacio IS
  'Notifica al usuario cuando su reserva cambia a aprobada o rechazada';
