-- Un solo Excel de SICAS por trámite.
--
-- `process-poliza-pdf` corre UNA VEZ POR PDF, y rehace el Excel completo en
-- cada corrida: borra el anterior e inserta el nuevo. Con un solo archivo
-- funciona; con nueve subidos de golpe las corridas se solapan, varias borran
-- cuando todavía no hay nada y luego cada una inserta lo suyo. El trámite
-- TK0F7A2-A terminó con tres `TK0F7A2-A-SICAS.xlsx` en la lista de adjuntos.
--
-- Arreglarlo en la función no alcanza: dos corridas en paralelo siempre pueden
-- colarse entre el borrado y el alta. Esto lo cierra en la base, donde cada
-- INSERT es atómico: al entrar un Excel nuevo, los anteriores del mismo trámite
-- se van. El último en llegar gana, que es justo lo que se quiere — el Excel se
-- rehace entero cada vez, con todas las filas.

CREATE OR REPLACE FUNCTION public.limpiar_excel_sicas_anterior()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nombre NOT LIKE '%-SICAS.xlsx' THEN
    RETURN NEW;
  END IF;

  DELETE FROM ticket_archivos a
  WHERE a.ticket_id = NEW.ticket_id
    AND a.nombre LIKE '%-SICAS.xlsx'
    -- Solo los que llegaron antes que este. Si dos entran a la vez, el que
    -- quede más viejo se va y el otro sobrevive: nunca se borran los dos.
    AND (a.created_at, a.id) < (NEW.created_at, NEW.id);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_limpiar_excel_sicas_anterior ON public.ticket_archivos;
CREATE TRIGGER trg_limpiar_excel_sicas_anterior
  AFTER INSERT ON public.ticket_archivos
  FOR EACH ROW EXECUTE FUNCTION public.limpiar_excel_sicas_anterior();

-- Los duplicados que ya existen: se queda el más reciente de cada trámite.
DELETE FROM public.ticket_archivos a
USING public.ticket_archivos b
WHERE a.nombre LIKE '%-SICAS.xlsx'
  AND b.nombre LIKE '%-SICAS.xlsx'
  AND a.ticket_id = b.ticket_id
  AND (a.created_at, a.id) < (b.created_at, b.id);
