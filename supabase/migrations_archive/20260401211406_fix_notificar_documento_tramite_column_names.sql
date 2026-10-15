/*
  # Corregir función notificar_documento_tramite con nombres de columnas correctos

  1. Cambios
    - Actualizar función para usar columnas correctas de ticket_archivos
    - url en lugar de ruta_archivo
    - tipo en lugar de tipo_archivo

  2. Tabla ticket_archivos tiene:
    - id, ticket_id, usuario_id, nombre, url, tipo, tamano, fecha_subida, metadata
*/

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
  v_attachments jsonb;
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

  v_url := 'https://app.movi.digital/tramites/' || v_tramite.id;

  -- Construir JSON de adjuntos usando la URL directamente de la tabla
  -- NEW.url ya contiene la URL pública del archivo desde storage
  v_attachments := jsonb_build_array(
    jsonb_build_object(
      'filename', NEW.nombre,
      'content_type', NEW.tipo,
      'url', NEW.url
    )
  );

  RAISE NOTICE 'Enviando notificación con adjunto: % (%) desde %', NEW.nombre, v_tamano_texto, NEW.url;

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
    p_link_url := v_url,
    p_attachments := v_attachments
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notificar_documento_tramite IS 'Notifica al agente cuando se carga un documento en su trámite, adjuntando el archivo al correo usando la URL de storage';
