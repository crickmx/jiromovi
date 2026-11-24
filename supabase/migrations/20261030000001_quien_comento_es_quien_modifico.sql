-- H-006 — "Última modificación" nombraba a quien NO modificó.
--
-- Reproducido el 30/10: DIEGO comentó en TKDE85F a las 15:56 y el encabezado
-- puso «15:56 · MATEO PRUEBAS». La hora era la del comentario de Diego; el
-- nombre, el del último que había escrito en `tickets`.
--
-- La cadena es esta:
--   1. insertar un comentario dispara `actualizar_ultima_accion_ticket()`
--   2. esa función hace UPDATE sobre `tickets` (pone `ultima_accion_por`)
--   3. ese UPDATE dispara `update_tickets_ultima_modificacion()`, que pone
--      `ultima_modificacion = now()`
--   4. y NADIE toca `modificado_por`
--
-- O sea que la fecha avanza sola y el nombre se queda clavado. Es un dato de
-- auditoría afirmando que alguien tocó el trámite a una hora en la que no lo
-- tocó — de los errores que no se notan hasta que alguien los usa para
-- reclamarle a la persona equivocada.
--
-- El arreglo es una línea en el mismo UPDATE. Va aquí y no en el frontend
-- porque un comentario puede entrar por varios caminos y todos pasan por este
-- trigger; parchar la pantalla dejaría los demás igual de mentirosos.
--
-- `ultima_accion_por` NO se toca: es otra cosa (alimenta "Requiere atención")
-- y comparte el mismo valor por coincidencia, no por significado.

create or replace function public.actualizar_ultima_accion_ticket()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  -- Cortar si estamos dentro de otro trigger (evita loops)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE tickets
  SET ultima_accion_por = NEW.usuario_id,
      -- H-006: quien comenta ES quien acaba de modificar el trámite. Sin esta
      -- línea, `ultima_modificacion` avanza (por el trigger de UPDATE) con el
      -- nombre del anterior.
      modificado_por = NEW.usuario_id
  WHERE id = NEW.ticket_id;

  RETURN NEW;
END;
$function$;
