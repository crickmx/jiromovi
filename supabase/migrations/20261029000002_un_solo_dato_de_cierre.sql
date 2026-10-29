-- QA 2026-10-22 (A3) · Un trámite cerrado está cerrado para todos
--
-- `tickets` tiene TRES columnas de cierre y cada camino escribe una distinta:
--
--   · `cerrado_en`   timestamptz — la escribe el frontend, SIEMPRE, por los dos
--                    caminos: el de Cotización/Emisión (`esFinalCotizacion`) y
--                    el del FormBuilder (`clasificacion = 'terminacion'`).
--                    Reabrir la pone en null. Es la que lee toda la app.
--   · `cerrado`      boolean    — la pone `calculate_ticket_resultado()`.
--   · `fecha_cierre` timestamptz — la pone la misma función.
--
-- El problema: esa función **sale temprano** si el tipo de trámite no es
-- `registro_actividad` ni `cotizacion_emision` —los dos Legacy, y el segundo
-- dado de baja en septiembre—. Para cualquier tipo del FormBuilder nunca corre,
-- así que `cerrado` se queda en `false` para siempre, aunque el trámite esté
-- cerrado y la pantalla lo muestre en "Terminados".
--
-- **Qué se rompe de verdad con eso**, que no es lo que decía el reporte de QA:
-- `cerrado` no alimenta ningún KPI. Lo lee UNA función del Centro de Contacto
-- (el CTE `allowed_agents`) para decidir qué conversaciones ve un ejecutivo. Con
-- `cerrado = false` eterno, un ejecutivo sigue viendo las conversaciones de
-- agentes cuyos trámites se cerraron hace meses.
--
-- Lo que NO se hace aquí, y es a propósito: extender
-- `calculate_ticket_resultado()` a todos los tipos. Esa función además escribe
-- `resultado = 'ganado' | 'perdido'`, que son conceptos del embudo de
-- Cotización/Emisión; aplicarlos a un trámite de Mesa de Control ensuciaría las
-- estadísticas de emitidos/no emitidos con filas que no son ventas.
--
-- La regla queda en una sola línea: **`cerrado` sigue a `cerrado_en`**, que es
-- el único dato que todos los caminos escriben.

begin;

set local lock_timeout = '5s';

create or replace function public.sincronizar_cerrado_con_cerrado_en()
returns trigger
language plpgsql
as $$
begin
  -- Sin condiciones ni excepciones por tipo: si tiene fecha de cierre está
  -- cerrado, y si no, no. Cualquier matiz aquí es otra forma de que las dos
  -- columnas se vuelvan a separar.
  new.cerrado := (new.cerrado_en is not null);
  return new;
end;
$$;

comment on function public.sincronizar_cerrado_con_cerrado_en() is
  'Mantiene tickets.cerrado igual a (cerrado_en is not null). El trigger se llama zz_* para correr DESPUÉS de los demás BEFORE, que Postgres dispara en orden alfabético.';

-- El nombre empieza con zz a propósito: Postgres dispara los BEFORE en orden
-- alfabético, y este tiene que ganarle a `trg_calculate_ticket_resultado` y a
-- `validate_registro_actividades_trigger`, que también tocan la fila.
drop trigger if exists zz_sincronizar_cerrado on public.tickets;
create trigger zz_sincronizar_cerrado
  before insert or update on public.tickets
  for each row execute function public.sincronizar_cerrado_con_cerrado_en();

-- Backfill de lo que ya está en la base.
--
-- No dispara avisos ni ensucia el historial: `notificar_actualizacion_tramite`
-- solo reacciona a tipo, prioridad, póliza, instrucciones y responsable;
-- `registrar_cambio_ticket` a estatus y prioridad; y `log_ticket_cambio` mira
-- `cerrado_en`, que aquí no se toca. Se verificó uno por uno antes de correrlo.
--
-- Las filas Legacy que tengan `cerrado = true` con `cerrado_en` nulo pasan a
-- false. Es lo correcto: si no tienen fecha de cierre, la pantalla ya las
-- muestra abiertas, y lo que se ve y lo que se filtra no deben contradecirse.
update public.tickets
   set cerrado = (cerrado_en is not null)
 where cerrado is distinct from (cerrado_en is not null);

comment on column public.tickets.cerrado is
  'Derivada de cerrado_en por el trigger zz_sincronizar_cerrado. No escribirla a mano: la fuente de verdad del cierre es cerrado_en.';

comment on column public.tickets.fecha_cierre is
  'DEPRECADA. Solo la escribe calculate_ticket_resultado() para los dos tipos Legacy, y ningún consumidor la lee. La fecha de cierre real es cerrado_en.';

comment on column public.tickets.resultado is
  'ganado | perdido | en_progreso. SOLO aplica al embudo de Cotización/Emisión (tipos registro_actividad y cotizacion_emision); la alimentan las estadísticas de emitidos/no emitidos. En cualquier otro tipo es null a propósito.';

commit;

-- Reversa (solo si algo falla):
-- begin;
-- drop trigger if exists zz_sincronizar_cerrado on public.tickets;
-- drop function if exists public.sincronizar_cerrado_con_cerrado_en();
-- -- El backfill no se revierte: dejaba `cerrado` contradiciendo a la pantalla.
-- commit;
