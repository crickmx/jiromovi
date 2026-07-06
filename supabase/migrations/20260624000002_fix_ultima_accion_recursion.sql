/*
  # Fix: stack depth limit exceeded en actualizar_ultima_accion_ticket

  El trigger en ticket_historial causaba recursión infinita:
  INSERT ticket_historial → UPDATE tickets → trigger tickets → INSERT ticket_historial → loop

  Fix: pg_trigger_depth() > 1 corta cualquier llamada recursiva.
  También eliminamos el trigger en ticket_historial (el más conflictivo)
  ya que comentarios y archivos son suficientes para cubrir el caso de uso.
*/

-- Eliminar el trigger en historial (causa el loop con triggers internos de tickets)
DROP TRIGGER IF EXISTS trg_historial_ultima_accion ON ticket_historial;

-- Reescribir la función con guard anti-recursión
CREATE OR REPLACE FUNCTION actualizar_ultima_accion_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cortar si estamos dentro de otro trigger (evita loops)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE tickets
  SET ultima_accion_por = NEW.usuario_id
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$$;
