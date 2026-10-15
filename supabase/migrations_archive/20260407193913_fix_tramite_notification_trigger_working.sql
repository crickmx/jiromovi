/*
  # Arreglar trigger de notificación de documentos en trámites
  
  El problema era que get_tramite_attachments causaba error de GROUP BY.
  La solución es simplificar la función para evitar conflictos con RLS.
*/

-- Recrear la función sin ORDER BY dentro del agregado
DROP FUNCTION IF EXISTS get_tramite_attachments(uuid);

CREATE OR REPLACE FUNCTION get_tramite_attachments(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'filename', nombre,
        'path', url,
        'content_type', COALESCE(tipo, 'application/octet-stream'),
        'size', tamano
      )
    ),
    '[]'::jsonb
  )
  FROM ticket_archivos
  WHERE ticket_id = p_ticket_id;
$$;

-- Verificar que la función de notificación existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'notificar_documento_tramite'
  ) THEN
    -- Crear la función de notificación
    CREATE FUNCTION notificar_documento_tramite()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $func$
    DECLARE
      v_ticket tickets;
      v_responsable_nombre text;
      v_attachments jsonb;
    BEGIN
      -- Obtener información del ticket
      SELECT t.* INTO v_ticket
      FROM tickets t
      WHERE t.id = NEW.ticket_id;
      
      IF NOT FOUND THEN
        RETURN NEW;
      END IF;
      
      -- Obtener nombre del responsable
      SELECT nombre_completo INTO v_responsable_nombre
      FROM usuarios
      WHERE id = v_ticket.agente_id;
      
      -- Obtener todos los adjuntos del ticket
      v_attachments := get_tramite_attachments(NEW.ticket_id);
      
      -- Enviar notificación al usuario relacionado
      IF v_ticket.usuario_id IS NOT NULL THEN
        PERFORM enviar_notificacion_completa(
          p_tipo := 'documento_tramite',
          p_destinatario_id := v_ticket.usuario_id,
          p_data := jsonb_build_object(
            'ticket_id', v_ticket.id::text,
            'folio', v_ticket.folio,
            'titulo', v_ticket.titulo,
            'filename', NEW.nombre,
            'responsable_nombre', COALESCE(v_responsable_nombre, 'Sistema'),
            'attachments', v_attachments
          )
        );
      END IF;
      
      RETURN NEW;
    END;
    $func$;
  END IF;
END $$;

-- Habilitar el trigger
ALTER TABLE ticket_archivos 
  ENABLE TRIGGER trigger_notificar_documento_tramite;

-- Si el trigger no existe, crearlo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_notificar_documento_tramite'
  ) THEN
    CREATE TRIGGER trigger_notificar_documento_tramite
      AFTER INSERT ON ticket_archivos
      FOR EACH ROW
      EXECUTE FUNCTION notificar_documento_tramite();
  END IF;
END $$;

COMMENT ON FUNCTION get_tramite_attachments(uuid) IS
  'Obtiene adjuntos de un trámite sin ORDER BY para evitar conflictos con RLS';

COMMENT ON TRIGGER trigger_notificar_documento_tramite ON ticket_archivos IS
  'Notifica al usuario cuando se sube un documento a su trámite';
