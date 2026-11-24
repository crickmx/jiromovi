/*
  # Globito al crear un trámite

  Cuando se crea un ticket, el creador queda como ultima_accion_por.
  Así el responsable (Yuri) ve el globito inmediatamente.
*/

CREATE OR REPLACE FUNCTION set_ultima_accion_en_creacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.ultima_accion_por := NEW.creado_por;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_creacion_ultima_accion ON tickets;
CREATE TRIGGER trg_ticket_creacion_ultima_accion
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ultima_accion_en_creacion();
