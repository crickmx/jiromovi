/*
  # Fix Tramite Notifications - Complete Overhaul

  ## Problem Summary
  1. `trigger_notificar_documento_tramite` was DISABLED due to RLS/GROUP BY errors
  2. All notification functions only notify `agente_id` - they skip `assigned_to_user_id` and `creado_por`
  3. `notificar_actualizacion_tramite` calls `get_tramite_attachments()` on UPDATE which causes issues
  4. URL format inconsistent (some used full URLs, should be relative)

  ## Changes
  1. Fix `notificar_comentario_tramite` - notify agente_id, assigned_to_user_id, creado_por (skip self)
  2. Fix `notificar_cambio_estatus_tramite` - same multi-recipient logic
  3. Fix `notificar_documento_tramite` - remove attachments to avoid RLS issues, multi-recipient
  4. Fix `notificar_actualizacion_tramite` - remove get_tramite_attachments(), multi-recipient
  5. Re-enable trigger_notificar_documento_tramite

  ## Security
  - All functions use SECURITY DEFINER to bypass RLS in triggers
*/

-- ============================================================
-- HELPER: Send notification to all relevant tramite recipients
-- ============================================================

CREATE OR REPLACE FUNCTION notify_tramite_recipients(
  p_ticket_id uuid,
  p_codigo_tipo text,
  p_variables jsonb,
  p_excluir_user_id uuid DEFAULT NULL,
  p_adjuntos jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t RECORD;
  v_recipient_ids uuid[];
  v_uid uuid;
BEGIN
  SELECT agente_id, assigned_to_user_id, creado_por
  INTO v_t
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_recipient_ids := ARRAY[]::uuid[];

  IF v_t.agente_id IS NOT NULL THEN
    v_recipient_ids := array_append(v_recipient_ids, v_t.agente_id);
  END IF;

  IF v_t.assigned_to_user_id IS NOT NULL AND NOT (v_t.assigned_to_user_id = ANY(v_recipient_ids)) THEN
    v_recipient_ids := array_append(v_recipient_ids, v_t.assigned_to_user_id);
  END IF;

  IF v_t.creado_por IS NOT NULL AND NOT (v_t.creado_por = ANY(v_recipient_ids)) THEN
    v_recipient_ids := array_append(v_recipient_ids, v_t.creado_por);
  END IF;

  FOREACH v_uid IN ARRAY v_recipient_ids LOOP
    IF p_excluir_user_id IS NOT NULL AND v_uid = p_excluir_user_id THEN
      CONTINUE;
    END IF;

    PERFORM enviar_notificacion_transaccional(
      p_codigo_tipo  := p_codigo_tipo,
      p_destinatario_id := v_uid,
      p_variables    := p_variables,
      p_adjuntos     := p_adjuntos
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 1. Notificar NUEVO COMENTARIO
-- ============================================================

CREATE OR REPLACE FUNCTION notificar_comentario_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tramite RECORD;
  v_autor RECORD;
  v_estatus_nombre TEXT;
  v_variables jsonb;
BEGIN
  SELECT t.id, t.folio, t.tipo_tramite, t.estatus_id, te.nombre AS estatus_nombre
  INTO v_tramite
  FROM tickets t
  LEFT JOIN ticket_estatus te ON te.id = t.estatus_id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol INTO v_autor
  FROM usuarios WHERE id = NEW.usuario_id;

  v_variables := jsonb_build_object(
    'folio',         v_tramite.folio,
    'agente_nombre', '',
    'comentario',    NEW.mensaje,
    'autor_nombre',  COALESCE(v_autor.nombre_completo, 'Usuario'),
    'autor_rol',     COALESCE(v_autor.rol, ''),
    'tipo_tramite',  COALESCE(v_tramite.tipo_tramite, ''),
    'estatus',       COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
    'url',           '/tramites/' || v_tramite.id
  );

  PERFORM notify_tramite_recipients(
    p_ticket_id       := NEW.ticket_id,
    p_codigo_tipo     := 'tramite_comentario_nuevo',
    p_variables       := v_variables,
    p_excluir_user_id := NEW.usuario_id
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Notificar CAMBIO DE ESTATUS
-- ============================================================

CREATE OR REPLACE FUNCTION notificar_cambio_estatus_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_modificador RECORD;
  v_estatus_anterior TEXT;
  v_estatus_nuevo TEXT;
  v_variables jsonb;
BEGIN
  IF OLD.estatus_id IS NOT DISTINCT FROM NEW.estatus_id THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol INTO v_modificador
  FROM usuarios WHERE id = NEW.modificado_por;

  SELECT nombre INTO v_estatus_anterior
  FROM ticket_estatus WHERE id = OLD.estatus_id;

  SELECT nombre INTO v_estatus_nuevo
  FROM ticket_estatus WHERE id = NEW.estatus_id;

  v_variables := jsonb_build_object(
    'folio',            NEW.folio,
    'agente_nombre',    '',
    'estatus_anterior', COALESCE(v_estatus_anterior, 'Sin estatus'),
    'estatus_nuevo',    COALESCE(v_estatus_nuevo, 'Sin estatus'),
    'modificado_por',   COALESCE(v_modificador.nombre_completo, 'Sistema'),
    'rol_modificador',  COALESCE(v_modificador.rol, ''),
    'tipo_tramite',     COALESCE(NEW.tipo_tramite, ''),
    'url',              '/tramites/' || NEW.id
  );

  PERFORM notify_tramite_recipients(
    p_ticket_id       := NEW.id,
    p_codigo_tipo     := 'tramite_cambio_estatus',
    p_variables       := v_variables,
    p_excluir_user_id := NEW.modificado_por
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Notificar DOCUMENTO CARGADO (sin adjuntos para evitar RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION notificar_documento_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tramite RECORD;
  v_subidor RECORD;
  v_tamano_texto TEXT;
  v_variables jsonb;
BEGIN
  SELECT t.id, t.folio, t.tipo_tramite, te.nombre AS estatus_nombre
  INTO v_tramite
  FROM tickets t
  LEFT JOIN ticket_estatus te ON te.id = t.estatus_id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol INTO v_subidor
  FROM usuarios WHERE id = NEW.usuario_id;

  IF NEW.tamano IS NOT NULL THEN
    IF NEW.tamano < 1024 THEN
      v_tamano_texto := NEW.tamano || ' bytes';
    ELSIF NEW.tamano < 1048576 THEN
      v_tamano_texto := ROUND(NEW.tamano / 1024.0, 2) || ' KB';
    ELSE
      v_tamano_texto := ROUND(NEW.tamano / 1048576.0, 2) || ' MB';
    END IF;
  ELSE
    v_tamano_texto := 'Desconocido';
  END IF;

  v_variables := jsonb_build_object(
    'folio',         v_tramite.folio,
    'agente_nombre', '',
    'nombre_archivo', NEW.nombre,
    'subido_por',    COALESCE(v_subidor.nombre_completo, 'Usuario'),
    'rol_subidor',   COALESCE(v_subidor.rol, ''),
    'tamano_archivo', v_tamano_texto,
    'tipo_tramite',  COALESCE(v_tramite.tipo_tramite, ''),
    'estatus',       COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
    'url',           '/tramites/' || v_tramite.id
  );

  PERFORM notify_tramite_recipients(
    p_ticket_id       := NEW.ticket_id,
    p_codigo_tipo     := 'tramite_documento_cargado',
    p_variables       := v_variables,
    p_excluir_user_id := NEW.usuario_id
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Notificar ACTUALIZACIÓN GENERAL (sin get_tramite_attachments)
-- ============================================================

CREATE OR REPLACE FUNCTION notificar_actualizacion_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_modificador RECORD;
  v_estatus_nombre TEXT;
  v_campos_modificados TEXT[];
  v_variables jsonb;
BEGIN
  v_campos_modificados := ARRAY[]::TEXT[];

  IF OLD.tipo_tramite IS DISTINCT FROM NEW.tipo_tramite THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Tipo de trámite');
  END IF;

  IF OLD.prioridad IS DISTINCT FROM NEW.prioridad THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Prioridad');
  END IF;

  IF OLD.poliza IS DISTINCT FROM NEW.poliza THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Póliza');
  END IF;

  IF OLD.instrucciones IS DISTINCT FROM NEW.instrucciones THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Instrucciones');
  END IF;

  IF OLD.assigned_to_user_id IS DISTINCT FROM NEW.assigned_to_user_id THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Responsable');
  END IF;

  IF array_length(v_campos_modificados, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol INTO v_modificador
  FROM usuarios WHERE id = NEW.modificado_por;

  SELECT nombre INTO v_estatus_nombre
  FROM ticket_estatus WHERE id = NEW.estatus_id;

  v_variables := jsonb_build_object(
    'folio',              NEW.folio,
    'agente_nombre',      '',
    'modificado_por',     COALESCE(v_modificador.nombre_completo, 'Sistema'),
    'rol_modificador',    COALESCE(v_modificador.rol, ''),
    'campos_modificados', array_to_string(v_campos_modificados, ', '),
    'tipo_tramite',       COALESCE(NEW.tipo_tramite, ''),
    'estatus',            COALESCE(v_estatus_nombre, 'Sin estatus'),
    'url',                '/tramites/' || NEW.id
  );

  PERFORM notify_tramite_recipients(
    p_ticket_id       := NEW.id,
    p_codigo_tipo     := 'tramite_actualizado',
    p_variables       := v_variables,
    p_excluir_user_id := NEW.modificado_por
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- Recreate triggers (ensure all are active)
-- ============================================================

DROP TRIGGER IF EXISTS trigger_notificar_comentario_tramite ON ticket_comentarios;
CREATE TRIGGER trigger_notificar_comentario_tramite
  AFTER INSERT ON ticket_comentarios
  FOR EACH ROW
  EXECUTE FUNCTION notificar_comentario_tramite();

DROP TRIGGER IF EXISTS trigger_notificar_cambio_estatus_tramite ON tickets;
CREATE TRIGGER trigger_notificar_cambio_estatus_tramite
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notificar_cambio_estatus_tramite();

DROP TRIGGER IF EXISTS trigger_notificar_documento_tramite ON ticket_archivos;
CREATE TRIGGER trigger_notificar_documento_tramite
  AFTER INSERT ON ticket_archivos
  FOR EACH ROW
  EXECUTE FUNCTION notificar_documento_tramite();

DROP TRIGGER IF EXISTS trigger_notificar_actualizacion_tramite ON tickets;
CREATE TRIGGER trigger_notificar_actualizacion_tramite
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notificar_actualizacion_tramite();
