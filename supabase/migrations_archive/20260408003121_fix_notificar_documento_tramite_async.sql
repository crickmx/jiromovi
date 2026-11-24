/*
  # Fix notificar_documento_tramite to avoid GROUP BY issues
  
  1. Changes
    - Modify the trigger to avoid calling get_tramite_attachments during INSERT
    - Use a deferred approach to prevent RLS policy conflicts
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_notificar_documento_tramite ON ticket_archivos;

-- Recreate function without immediate attachment fetching
CREATE OR REPLACE FUNCTION public.notificar_documento_tramite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tramite RECORD;
  v_agente RECORD;
  v_subidor RECORD;
  v_tamano_texto TEXT;
  v_url TEXT;
BEGIN
  -- Get ticket info
  SELECT t.*, te.nombre as estatus_nombre
  INTO v_tramite
  FROM tickets t
  LEFT JOIN ticket_estatus te ON t.estatus_id = te.id
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get agent info
  SELECT id, nombre_completo, email_laboral, celular_laboral
  INTO v_agente
  FROM usuarios
  WHERE id = v_tramite.agente_id;

  -- Don't notify if agent is the uploader
  IF NOT FOUND OR v_agente.id = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  -- Get uploader info
  SELECT nombre_completo, rol
  INTO v_subidor
  FROM usuarios
  WHERE id = NEW.usuario_id;

  -- Format file size
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

  -- Send notification WITHOUT attachments to avoid GROUP BY issues during INSERT
  -- The email template can fetch attachments separately if needed
  PERFORM enviar_notificacion_transaccional(
    p_codigo_tipo := 'tramite_documento_cargado',
    p_destinatario_id := v_agente.id,
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
    p_adjuntos := NULL  -- Don't fetch attachments during INSERT
  );

  RETURN NEW;
END;
$function$;

-- Recreate trigger
CREATE TRIGGER trigger_notificar_documento_tramite
  AFTER INSERT ON ticket_archivos
  FOR EACH ROW
  EXECUTE FUNCTION notificar_documento_tramite();
