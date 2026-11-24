/*
  # Fix get_tramite_attachments GROUP BY issue
  
  1. Changes
    - Modify get_tramite_attachments to use explicit column selection
    - This avoids RLS policy conflicts with GROUP BY during INSERT operations
*/

CREATE OR REPLACE FUNCTION public.get_tramite_attachments(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attachments jsonb;
BEGIN
  -- Use explicit column selection to avoid RLS GROUP BY issues
  SELECT jsonb_agg(
    jsonb_build_object(
      'filename', ta.nombre,
      'path', ta.url,
      'content_type', COALESCE(ta.tipo, 'application/octet-stream'),
      'size', ta.tamano
    )
  )
  INTO v_attachments
  FROM (
    SELECT 
      id,
      nombre,
      url,
      tipo,
      tamano,
      fecha_subida
    FROM ticket_archivos
    WHERE ticket_id = p_ticket_id
    ORDER BY fecha_subida ASC
  ) ta;

  RETURN COALESCE(v_attachments, '[]'::jsonb);
END;
$function$;
