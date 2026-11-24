/*
  # Add instrucciones/descripción to tramite notification payloads

  All 4 tramite notification trigger functions are updated to include the
  `instrucciones` field from the tickets table in their payloads.
  The notification_events_catalog templates are also updated to expose
  {{instrucciones}} in email and in-app templates.

  ## Changes
  1. notificar_comentario_tramite - fetch instrucciones from ticket, add to payload
  2. notificar_documento_tramite  - fetch instrucciones from ticket, add to payload
  3. notificar_cambio_estatus_tramite - instrucciones already on NEW, add to payload
  4. notificar_actualizacion_tramite  - instrucciones already on NEW, add to payload
  5. Update notification_events_catalog templates to include instrucciones variable
*/

-- 1. notificar_comentario_tramite
CREATE OR REPLACE FUNCTION notificar_comentario_tramite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tramite RECORD;
  v_autor RECORD;
  v_variables jsonb;
BEGIN
  SELECT t.id, t.folio, t.tipo_tramite, t.estatus_id, t.instrucciones,
         te.nombre AS estatus_nombre
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
    'instrucciones', COALESCE(v_tramite.instrucciones, ''),
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

-- 2. notificar_documento_tramite
CREATE OR REPLACE FUNCTION notificar_documento_tramite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tramite RECORD;
  v_subidor RECORD;
  v_tamano_texto TEXT;
  v_variables jsonb;
BEGIN
  SELECT t.id, t.folio, t.tipo_tramite, t.instrucciones,
         te.nombre AS estatus_nombre
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
    'folio',          v_tramite.folio,
    'agente_nombre',  '',
    'nombre_archivo', NEW.nombre,
    'subido_por',     COALESCE(v_subidor.nombre_completo, 'Usuario'),
    'rol_subidor',    COALESCE(v_subidor.rol, ''),
    'tamano_archivo', v_tamano_texto,
    'tipo_tramite',   COALESCE(v_tramite.tipo_tramite, ''),
    'estatus',        COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
    'instrucciones',  COALESCE(v_tramite.instrucciones, ''),
    'url',            '/tramites/' || v_tramite.id
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

-- 3. notificar_cambio_estatus_tramite
CREATE OR REPLACE FUNCTION notificar_cambio_estatus_tramite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'instrucciones',    COALESCE(NEW.instrucciones, ''),
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

-- 4. notificar_actualizacion_tramite
CREATE OR REPLACE FUNCTION notificar_actualizacion_tramite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'instrucciones',      COALESCE(NEW.instrucciones, ''),
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

-- 5. Update notification_events_catalog templates to expose instrucciones
UPDATE notification_events_catalog
SET
  template_in_app = jsonb_set(
    template_in_app,
    '{mensaje}',
    to_jsonb('{{autor_nombre}} agregó un comentario: {{comentario}}

Descripción del trámite: {{instrucciones}}'::text)
  ),
  template_email = template_email || '{"variables": ["folio", "agente_nombre", "comentario", "autor_nombre", "autor_rol", "tipo_tramite", "estatus", "instrucciones", "url"]}'::jsonb,
  updated_at = now()
WHERE event_code = 'tramite_comentario_nuevo';

UPDATE notification_events_catalog
SET
  template_in_app = jsonb_set(
    template_in_app,
    '{mensaje}',
    to_jsonb('{{subido_por}} cargó el archivo {{nombre_archivo}}.

Descripción del trámite: {{instrucciones}}'::text)
  ),
  template_email = template_email || '{"variables": ["folio", "agente_nombre", "nombre_archivo", "subido_por", "rol_subidor", "tamano_archivo", "tipo_tramite", "estatus", "instrucciones", "url"]}'::jsonb,
  updated_at = now()
WHERE event_code = 'tramite_documento_cargado';

UPDATE notification_events_catalog
SET
  template_in_app = jsonb_set(
    template_in_app,
    '{mensaje}',
    to_jsonb('El estatus de tu trámite cambió de {{estatus_anterior}} a {{estatus_nuevo}}.

Descripción: {{instrucciones}}'::text)
  ),
  template_email = template_email || '{"variables": ["folio", "agente_nombre", "estatus_anterior", "estatus_nuevo", "modificado_por", "rol_modificador", "tipo_tramite", "instrucciones", "url"]}'::jsonb,
  updated_at = now()
WHERE event_code = 'tramite_cambio_estatus';

UPDATE notification_events_catalog
SET
  template_in_app = jsonb_set(
    template_in_app,
    '{mensaje}',
    to_jsonb('{{modificado_por}} actualizó: {{campos_modificados}}.

Descripción: {{instrucciones}}'::text)
  ),
  template_email = template_email || '{"variables": ["folio", "agente_nombre", "modificado_por", "rol_modificador", "campos_modificados", "tipo_tramite", "estatus", "instrucciones", "url"]}'::jsonb,
  updated_at = now()
WHERE event_code = 'tramite_actualizado';
