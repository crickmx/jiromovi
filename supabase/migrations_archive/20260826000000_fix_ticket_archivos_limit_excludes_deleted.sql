CREATE OR REPLACE FUNCTION validate_ticket_file_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_current_count
  FROM ticket_archivos
  WHERE ticket_id = NEW.ticket_id
    AND eliminado_at IS NULL;

  IF v_current_count >= 20 THEN
    RAISE EXCEPTION 'Este trámite permite un máximo de 20 documentos adjuntos. Elimina algún archivo o reduce la cantidad para continuar.';
  END IF;

  RETURN NEW;
END;
$$;
