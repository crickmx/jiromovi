/*
  # Fix tramite notifications — restaurar responsable como destinatario

  ## Problema
  1. `notify_tramite_recipients()` (migración 20260421175659) fue reducida a notificar
     solo al `agente_id`. Esto dejó sin notificaciones a los Empleados y Ejecutivos
     Comerciales que son `assigned_to_user_id` en los tickets.

  2. `notify_ticket_created_unassigned()` sale temprano cuando el ticket ya tiene
     `assigned_to_user_id`, lo que impide notificar al agente cuando el trámite
     se crea ya asignado (caso más común).

  ## Cambios
  1. `notify_tramite_recipients()`: notifica a agente_id + assigned_to_user_id,
     excluyendo al usuario que provocó el cambio (sin auto-notificación).

  2. `notify_ticket_created_unassigned()`: notifica siempre al agente_id al crear
     el trámite, independientemente del assignment_mode y del assigned_to_user_id.
     La notificación "Sin Asignar" a Mesa de Control sigue siendo exclusiva para
     tickets pool sin responsable.
*/

-- ============================================================
-- 1. notify_tramite_recipients: agente + responsable
-- ============================================================

CREATE OR REPLACE FUNCTION notify_tramite_recipients(
  p_ticket_id       uuid,
  p_codigo_tipo     text,
  p_variables       jsonb,
  p_excluir_user_id uuid DEFAULT NULL,
  p_adjuntos        jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t               RECORD;
  v_recipient_ids   uuid[];
  v_uid             uuid;
  v_recipient_name  text;
  v_personalized    jsonb;
BEGIN
  SELECT agente_id, assigned_to_user_id
  INTO v_t
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_recipient_ids := ARRAY[]::uuid[];

  IF v_t.agente_id IS NOT NULL THEN
    v_recipient_ids := array_append(v_recipient_ids, v_t.agente_id);
  END IF;

  IF v_t.assigned_to_user_id IS NOT NULL
     AND NOT (v_t.assigned_to_user_id = ANY(v_recipient_ids)) THEN
    v_recipient_ids := array_append(v_recipient_ids, v_t.assigned_to_user_id);
  END IF;

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
      p_adjuntos        := p_adjuntos
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 2. notify_ticket_created_unassigned: siempre notificar al agente
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_ticket_created_unassigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment_mode text;
  v_tipo_label      text;
  v_agente_nombre   text;
  v_folio           text;
BEGIN
  IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;

  SELECT assignment_mode, label INTO v_assignment_mode, v_tipo_label
  FROM ticket_tipos WHERE value = NEW.tipo_tramite;

  v_folio := COALESCE(NEW.folio, 'Sin folio');

  SELECT nombre_completo INTO v_agente_nombre
  FROM usuarios WHERE id = NEW.agente_id;

  -- Notificar al agente siempre que no sea quien creó el ticket
  IF NEW.agente_id IS NOT NULL AND NEW.agente_id IS DISTINCT FROM NEW.creado_por THEN
    INSERT INTO notifications (user_id, title, body, link_url, is_read)
    VALUES (
      NEW.agente_id,
      'Trámite Registrado',
      'Se registró el trámite ' || v_folio ||
        CASE WHEN v_tipo_label IS NOT NULL THEN ' — ' || v_tipo_label ELSE '' END || '.',
      '/tramites/' || NEW.id,
      false
    );
  END IF;

  -- Notificar al responsable siempre que no sea quien creó el ticket ni el mismo agente
  IF NEW.assigned_to_user_id IS NOT NULL
     AND NEW.assigned_to_user_id IS DISTINCT FROM NEW.creado_por
     AND NEW.assigned_to_user_id IS DISTINCT FROM NEW.agente_id THEN
    INSERT INTO notifications (user_id, title, body, link_url, is_read)
    VALUES (
      NEW.assigned_to_user_id,
      'Trámite Asignado',
      'Se te asignó el trámite ' || v_folio ||
        CASE WHEN v_tipo_label IS NOT NULL THEN ' — ' || v_tipo_label ELSE '' END || '.',
      '/tramites/' || NEW.id,
      false
    );
  END IF;

  -- Notificar a Mesa de Control y Admins solo para tickets pool sin asignar
  IF v_assignment_mode = 'pool' AND NEW.assigned_to_user_id IS NULL THEN

    INSERT INTO notifications (user_id, title, body, link_url, is_read)
    SELECT DISTINCT
      gm.usuario_id,
      'Trámite Sin Asignar',
      'Nuevo ' || v_folio || ' — ' || COALESCE(v_tipo_label, NEW.tipo_tramite) ||
      '. Agente: ' || COALESCE(v_agente_nombre, 'Sin nombre') || '. Pendiente de asignación.',
      '/tramites',
      false
    FROM tramites_grupos_miembros gm
    JOIN tramites_grupos_visualizacion gv ON gm.grupo_id = gv.id
    WHERE gv.activo         = true
      AND gv.area_categoria = 'Operaciones'
      AND gm.usuario_id IS DISTINCT FROM NEW.creado_por;

    INSERT INTO notifications (user_id, title, body, link_url, is_read)
    SELECT DISTINCT
      u.id,
      'Trámite Sin Asignar',
      'Nuevo ' || v_folio || ' — ' || COALESCE(v_tipo_label, NEW.tipo_tramite) ||
      '. Agente: ' || COALESCE(v_agente_nombre, 'Sin nombre') || '. Pendiente de asignación.',
      '/tramites',
      false
    FROM usuarios u
    WHERE u.rol    = 'Administrador'
      AND u.estado = 'activo'
      AND u.id IS DISTINCT FROM NEW.creado_por
      AND NOT EXISTS (
        SELECT 1
        FROM tramites_grupos_miembros gm2
        JOIN tramites_grupos_visualizacion gv2 ON gm2.grupo_id = gv2.id
        WHERE gm2.usuario_id     = u.id
          AND gv2.area_categoria = 'Operaciones'
      );

    IF NEW.creado_por IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, body, link_url, is_read)
      VALUES (
        NEW.creado_por,
        'Trámite Iniciado',
        'Tu trámite ' || v_folio || ' fue iniciado correctamente. Pronto será asignado a un ejecutivo de Mesa de Control.',
        '/tramites',
        false
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;
