/*
  # Fix get_tramite_attachments - error de GROUP BY
  
  El problema es que la función get_tramite_attachments se ejecuta dentro del trigger
  y las políticas RLS causan problemas con GROUP BY.
  
  Solución: Marcar la función como SECURITY DEFINER y asegurar que ignora RLS.
*/

-- Recrear la función para asegurar que bypasea RLS correctamente
DROP FUNCTION IF EXISTS get_tramite_attachments(uuid);

CREATE OR REPLACE FUNCTION get_tramite_attachments(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attachments jsonb;
BEGIN
  -- Usar un SELECT más simple sin ORDER BY dentro del agregado
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'filename', ta.nombre,
        'path', ta.url,
        'content_type', COALESCE(ta.tipo, 'application/octet-stream'),
        'size', ta.tamano
      ) ORDER BY ta.fecha_subida ASC
    ),
    '[]'::jsonb
  )
  INTO v_attachments
  FROM ticket_archivos ta
  WHERE ta.ticket_id = p_ticket_id;
  
  RETURN v_attachments;
END;
$$;

COMMENT ON FUNCTION get_tramite_attachments(uuid) IS
  'Obtiene todos los archivos adjuntos de un trámite como JSON para notificaciones';
