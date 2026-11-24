/*
  # Fix: URLs de Notificaciones de Trámites - Usar Rutas Relativas

  1. Problema
    - Las funciones de notificación generan URLs como "https://moviapp.com/tramites/..."
    - Esto causa errores de navegación: "/dashboard/https:/app.movi.digital/tramites/..."

  2. Solución
    - Cambiar a rutas relativas: "/tramites/..."
    - El sistema de notificaciones convierte automáticamente a URLs absolutas para email/WhatsApp
    - Las notificaciones in-app usan las rutas directamente
*/

-- Actualizar función de comentarios
CREATE OR REPLACE FUNCTION notificar_comentario_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tramite RECORD;
  v_agente RECORD;
  v_autor RECORD;
  v_url TEXT;
BEGIN
  SELECT t.*, te.nombre as estatus_nombre
  INTO v_tramite
  FROM tickets t
  LEFT JOIN ticket_estatus te ON t.estatus_id = te.id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = v_tramite.agente_id;

  IF NOT FOUND OR v_agente.id = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol
  INTO v_autor
  FROM usuarios
  WHERE id = NEW.usuario_id;

  v_url := '/tramites/' || v_tramite.id;

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_comentario_nuevo',
    p_user_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', v_tramite.folio,
      'agente_nombre', v_agente.nombre_completo,
      'comentario', NEW.mensaje,
      'autor_nombre', v_autor.nombre_completo,
      'autor_rol', v_autor.rol,
      'tipo_tramite', v_tramite.tipo_tramite,
      'estatus', COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
      'url', v_url
    ),
    p_link_url := v_url
  );

  RETURN NEW;
END;
$$;

-- Actualizar función de cambio de estatus
CREATE OR REPLACE FUNCTION notificar_cambio_estatus_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agente RECORD;
  v_modificador RECORD;
  v_estatus_anterior TEXT;
  v_estatus_nuevo TEXT;
  v_url TEXT;
BEGIN
  IF OLD.estatus_id IS NOT DISTINCT FROM NEW.estatus_id THEN
    RETURN NEW;
  END IF;

  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = NEW.agente_id;

  IF NOT FOUND OR v_agente.id = NEW.modificado_por THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol
  INTO v_modificador
  FROM usuarios
  WHERE id = NEW.modificado_por;

  SELECT nombre INTO v_estatus_anterior
  FROM ticket_estatus
  WHERE id = OLD.estatus_id;

  SELECT nombre INTO v_estatus_nuevo
  FROM ticket_estatus
  WHERE id = NEW.estatus_id;

  v_url := '/tramites/' || NEW.id;

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_cambio_estatus',
    p_user_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', NEW.folio,
      'agente_nombre', v_agente.nombre_completo,
      'estatus_anterior', COALESCE(v_estatus_anterior, 'Sin estatus'),
      'estatus_nuevo', COALESCE(v_estatus_nuevo, 'Sin estatus'),
      'modificado_por', v_modificador.nombre_completo,
      'rol_modificador', v_modificador.rol,
      'tipo_tramite', NEW.tipo_tramite,
      'url', v_url
    ),
    p_link_url := v_url
  );

  RETURN NEW;
END;
$$;

-- Actualizar función de documentos
CREATE OR REPLACE FUNCTION notificar_documento_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tramite RECORD;
  v_agente RECORD;
  v_subidor RECORD;
  v_tamano_texto TEXT;
  v_url TEXT;
BEGIN
  SELECT t.*, te.nombre as estatus_nombre
  INTO v_tramite
  FROM tickets t
  LEFT JOIN ticket_estatus te ON t.estatus_id = te.id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = v_tramite.agente_id;

  IF NOT FOUND OR v_agente.id = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol
  INTO v_subidor
  FROM usuarios
  WHERE id = NEW.usuario_id;

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

  v_url := '/tramites/' || v_tramite.id;

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_documento_cargado',
    p_user_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', v_tramite.folio,
      'agente_nombre', v_agente.nombre_completo,
      'nombre_archivo', NEW.nombre,
      'subido_por', v_subidor.nombre_completo,
      'rol_subidor', v_subidor.rol,
      'tamano_archivo', v_tamano_texto,
      'tipo_tramite', v_tramite.tipo_tramite,
      'estatus', COALESCE(v_tramite.estatus_nombre, 'Sin estatus'),
      'url', v_url
    ),
    p_link_url := v_url
  );

  RETURN NEW;
END;
$$;

-- Actualizar función de actualizaciones generales
CREATE OR REPLACE FUNCTION notificar_actualizacion_tramite()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agente RECORD;
  v_modificador RECORD;
  v_estatus_nombre TEXT;
  v_campos_modificados TEXT[];
  v_url TEXT;
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

  IF OLD.responsable_id IS DISTINCT FROM NEW.responsable_id THEN
    v_campos_modificados := array_append(v_campos_modificados, 'Responsable');
  END IF;

  IF array_length(v_campos_modificados, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = NEW.agente_id;

  IF NOT FOUND OR v_agente.id = NEW.modificado_por THEN
    RETURN NEW;
  END IF;

  SELECT nombre_completo, rol
  INTO v_modificador
  FROM usuarios
  WHERE id = NEW.modificado_por;

  SELECT nombre INTO v_estatus_nombre
  FROM ticket_estatus
  WHERE id = NEW.estatus_id;

  v_url := '/tramites/' || NEW.id;

  PERFORM send_transactional_notification(
    p_event_key := 'tramite_actualizado',
    p_user_id := v_agente.id,
    p_variables := jsonb_build_object(
      'folio', NEW.folio,
      'agente_nombre', v_agente.nombre_completo,
      'modificado_por', v_modificador.nombre_completo,
      'rol_modificador', v_modificador.rol,
      'campos_modificados', array_to_string(v_campos_modificados, ', '),
      'tipo_tramite', NEW.tipo_tramite,
      'estatus', COALESCE(v_estatus_nombre, 'Sin estatus'),
      'url', v_url
    ),
    p_link_url := v_url
  );

  RETURN NEW;
END;
$$;
