-- El costo de envío del pedido de MOVI Store, y que SUME al total.
--
-- Pedido de Ricardo (09/11): "hace falta campo para agregar los costos de
-- envío a un pedido. Ese campo debe sumarle al total."
--
-- ── Por qué una columna propia y no `store_pedido_gastos` ─────────────────
--
-- Esa tabla ya existe y parecía el lugar obvio, pero **los gastos de hoy son
-- del lado del COSTO**: lo que JIRO gasta, para medir margen. Por eso en un
-- pedido se ve "Total $650.00" junto a "Costo: $686.12" sin contradicción —
-- son dos cosas distintas.
--
-- El envío es lo contrario: es un cargo **al cliente**. Meterlo en la misma
-- tabla mezclaría "lo que gastamos" con "lo que cobramos", y entonces nadie
-- podría volver a leer un pedido sin preguntar de cuál de los dos se habla.
--
-- ── Por qué la vista se reescribe ─────────────────────────────────────────
--
-- Medido antes de tocar nada: el total del pedido se calcula en SEIS lugares
-- distintos, cada uno por su cuenta — la pantalla, la Orden de Compra, la
-- lista, el pedido completo, el `{{total}}` de los avisos, y esta vista (de la
-- que salen `monto`, `saldo` y `estado_pago` del control de pagos).
--
-- Sumar el envío en unos y no en otros produce exactamente el bug que ya se
-- pagó en octubre con Marketing Premium: la bitácora decía "$0 de $200"
-- mientras el panel de pagos decía $2,400. Aquí sería peor, porque el cliente
-- vería un total y se le cobraría otro.
--
-- Dentro de la vista, el total ahora se escribe **una sola vez** (en el
-- subselect) en lugar de repetir la expresión en `monto`, en `saldo` y tres
-- veces más en el `CASE`. Las columnas de salida que ya existían conservan su
-- nombre, su orden y su tipo —`create or replace view` lo exige— y solo se
-- AGREGAN dos al final: `articulos` y `costo_envio`, para poder ver de qué se
-- compone el monto sin tener que deducirlo.

begin;

set local lock_timeout = '5s';

-- ── 1. La columna ──────────────────────────────────────────────────────────

alter table public.store_pedidos
  add column if not exists costo_envio numeric(10,2) not null default 0;

comment on column public.store_pedidos.costo_envio is
  'Lo que se le cobra al cliente por el envío. SUMA al total del pedido. No confundir con store_pedido_gastos, que son costos de JIRO (margen), no cargos al cliente.';

-- Sin GRANT: `store_pedidos` tiene los permisos a nivel de TABLA (verificado
-- contra el baseline), así que una columna nueva queda cubierta sola. Quién
-- puede escribirla lo sigue decidiendo la RLS de siempre, y la pantalla que la
-- captura es solo de quien administra Store.

-- ── 2. La vista del control de pagos ───────────────────────────────────────

create or replace view public.store_bitacora_view with (security_invoker = true) as
select
  b.id,
  b.folio,
  b.fecha,
  b.solicitante_id,
  b.solicitante_nombre,
  b.responsable_id,
  b.responsable_nombre,
  b.cantidad,
  b.monto,
  b.forma_pago,
  b.metodo_pago,
  b.pagado,
  (b.monto - b.pagado) as saldo,
  case
    when b.monto = 0::numeric then 'sin_monto'::text
    when b.pagado >= (b.monto - 0.01) and b.pagado <= (b.monto + 0.01) then 'al_corriente'::text
    when b.pagado > (b.monto + 0.01) then 'a_favor'::text
    else 'debe'::text
  end as estado_pago,
  -- Las dos nuevas, al final: de qué se compone el monto.
  b.articulos,
  b.costo_envio
from (
  select
    p.id,
    p.folio_oc                                    as folio,
    p.created_at                                  as fecha,
    p.usuario_id                                  as solicitante_id,
    sol.nombre_completo                           as solicitante_nombre,
    p.responsable_pago_id                         as responsable_id,
    resp.nombre_completo                          as responsable_nombre,
    coalesce(d.cantidad_total, 0::bigint)         as cantidad,
    coalesce(d.monto_total, 0::numeric)           as articulos,
    coalesce(p.costo_envio, 0::numeric)           as costo_envio,
    -- EL total del pedido. Escrito una sola vez; `saldo` y `estado_pago` lo
    -- leen de aquí en vez de volver a sumarlo cada uno.
    coalesce(d.monto_total, 0::numeric) + coalesce(p.costo_envio, 0::numeric) as monto,
    p.forma_pago,
    (p.metodo_pago)::text                         as metodo_pago,
    coalesce(pg.pagado, 0::numeric)               as pagado
  from public.store_pedidos p
    left join public.usuarios sol  on sol.id  = p.usuario_id
    left join public.usuarios resp on resp.id = p.responsable_pago_id
    left join (
      select pedido_id,
             sum(cantidad)                             as cantidad_total,
             sum(cantidad::numeric * precio_unitario)  as monto_total
        from public.store_pedidos_detalle
       group by pedido_id
    ) d on d.pedido_id = p.id
    left join (
      select pedido_id, sum(monto) as pagado
        from public.store_pedido_pagos
       group by pedido_id
    ) pg on pg.pedido_id = p.id
) b;

commit;

-- Comprobación — un pedido con envío debe cuadrar `articulos + costo_envio`:
--
--   select folio, articulos, costo_envio, monto, pagado, saldo, estado_pago
--     from store_bitacora_view
--    where costo_envio > 0
--    order by fecha desc limit 10;
--
-- Y que ningún pedido existente haya cambiado de monto (el default es 0, así
-- que esto NO debe devolver nada):
--
--   select count(*) from store_bitacora_view where costo_envio <> 0;
--
-- Si la vista no aparece en PostgREST después de correr esto:
--   notify pgrst, 'reload schema';
