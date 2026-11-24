/*
  # Arreglar función get_tramite_attachments
  
  La tabla ticket_archivos no tiene columna deleted_at
*/

CREATE OR REPLACE FUNCTION get_tramite_attachments(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attachments jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'filename', nombre,
      'path', url,
      'content_type', COALESCE(tipo, 'application/octet-stream'),
      'size', tamano
    )
  )
  INTO v_attachments
  FROM ticket_archivos
  WHERE ticket_id = p_ticket_id
  ORDER BY fecha_subida ASC;
  
  RETURN COALESCE(v_attachments, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_tramite_attachments IS 
  'Obtiene todos los archivos de un trámite en formato JSON para adjuntar a correos';
