-- Los cargos al cliente del pedido: varios, con concepto propio.
--
-- Pedido de Ricardo (09/11, el mismo día que el envío): "Me gustaría poder
-- editar el concepto de los cargos al cliente y poder agregar más de uno.
-- Ejemplo, producción Express, o alguna otra cosa que surja."
--
-- ── Qué pasa con `costo_envio` ─────────────────────────────────────────────
--
-- Se va. Nació hoy mismo, unas horas antes, y dejarla viva al lado de la tabla
-- nueva sería tener DOS lugares de donde sale lo que se le cobra al cliente —
-- que es justo el problema que la propia migración de esta mañana vino a
-- cerrar. Lo capturado no se pierde: antes de borrarla, cada pedido con envío
-- se convierte en un renglón con concepto 'Envío'.
--
-- ── Por qué tabla propia y no una columna en `store_pedido_gastos` ─────────
--
-- Esa tabla parecía el lugar obvio (ya tiene concepto, monto y tipo), pero sus
-- filas son **lo que gasta JIRO**, y de ellas sale el margen. Marcarlas con un
-- `a_cargo_de` obligaría a filtrar en los TRES lectores que hoy suman el margen
-- (`StorePedidoDetalle`, `StorePedidosReporte` y el cálculo de ganancia), y
-- olvidar uno haría que un cargo al cliente se contara como costo de JIRO **en
-- silencio**. Una tabla aparte no toca nada de lo que ya funciona.
--
-- ── 🔴 Y de paso, un error de esta mañana ──────────────────────────────────
--
-- La migración de hoy actualizó `store_bitacora_view`… que **el frontend no
-- lee**. La pantalla de Bitácora consulta `bitacora_comercial_view`
-- (`VISTA_BITACORA` en `src/lib/bitacoraConfig.ts`), que calcula el monto de
-- Store por su cuenta. O sea que los cargos **no llegaban** al control de
-- pagos. Aquí se arreglan las dos: la que se lee y la que no.
--
-- Eran OCHO lugares donde se calculaba el total de un pedido, no siete.

begin;

set local lock_timeout = '5s';

-- ── 1. Quién administra Store ──────────────────────────────────────────────
-- Las políticas de `store_pedido_gastos` repiten este EXISTS en ocho políticas
-- superpuestas. Aquí se escribe UNA vez, con el mismo molde que
-- `mkt_puede_administrar()`, que ya existe y hace esto mismo para Marketing.
-- SECURITY DEFINER a propósito: sin eso, consultar `usuarios` y
-- `tramites_grupos_miembros` desde dentro de una política choca con la RLS de
-- esas tablas.

create or replace function public.store_puede_administrar()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
      select 1 from usuarios
       where id = auth.uid()
         and rol = any (array['Administrador','Gerente'])
         and (deleted_at is null or deleted_at > now())
    )
    or exists (
      select 1 from tramites_grupos_miembros m
        join store_equipos_acceso a on a.grupo_id = m.grupo_id
       where m.usuario_id = auth.uid()
    );
$$;

comment on function public.store_puede_administrar() is
  'Quién puede administrar MOVI Store: Administrador, Gerente, o miembro de un equipo con acceso en store_equipos_acceso. Mismo criterio que las políticas de store_pedido_gastos, en un solo lugar.';

-- ── 2. La tabla ────────────────────────────────────────────────────────────

create table if not exists public.store_pedido_cargos (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references public.store_pedidos(id) on delete cascade,
  concepto    text not null,
  monto       numeric(10,2) not null default 0,
  creado_por  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint store_pedido_cargos_concepto_no_vacio check (btrim(concepto) <> ''),
  -- Un cargo de cero no cobra nada y solo ensucia la Orden de Compra; uno
  -- negativo sería un descuento, que es otra conversación y hoy no existe.
  constraint store_pedido_cargos_monto_positivo check (monto > 0)
);

create index if not exists idx_store_pedido_cargos_pedido
  on public.store_pedido_cargos (pedido_id);

comment on table public.store_pedido_cargos is
  'Lo que se le COBRA al cliente además de los artículos: envío, producción express, lo que surja. SUMA al total del pedido. No confundir con store_pedido_gastos, que es lo que GASTA JIRO y de donde sale el margen.';

alter table public.store_pedido_cargos enable row level security;

-- Leer: si puedes ver el pedido, puedes ver sus cargos. Se escribe como un
-- EXISTS contra `store_pedidos` en vez de repetir sus condiciones, para que las
-- dos reglas no puedan separarse nunca: esa subconsulta ya pasa por la RLS de
-- `store_pedidos`.
--
-- 🔑 Y es lo que mantiene honesta a la Bitácora: las vistas son
-- `security_invoker`, así que si alguien pudiera ver el pedido pero no sus
-- cargos, la suma le saldría más baja **sin avisar** — una vista que dice un
-- monto distinto según quién la mire.
create policy store_pedido_cargos_select on public.store_pedido_cargos
  for select to authenticated
  using (exists (select 1 from public.store_pedidos p where p.id = pedido_id));

create policy store_pedido_cargos_insert on public.store_pedido_cargos
  for insert to authenticated with check (public.store_puede_administrar());

create policy store_pedido_cargos_update on public.store_pedido_cargos
  for update to authenticated
  using (public.store_puede_administrar())
  with check (public.store_puede_administrar());

create policy store_pedido_cargos_delete on public.store_pedido_cargos
  for delete to authenticated using (public.store_puede_administrar());

grant select, insert, update, delete on public.store_pedido_cargos to authenticated;
grant all on public.store_pedido_cargos to service_role;

-- ── 3. Lo capturado hoy en `costo_envio` se vuelve un renglón ──────────────

insert into public.store_pedido_cargos (pedido_id, concepto, monto)
select p.id, 'Envío', p.costo_envio
  from public.store_pedidos p
 where coalesce(p.costo_envio, 0) > 0;

-- ── 4. Las dos vistas ──────────────────────────────────────────────────────

-- 4a. `bitacora_comercial_view` — **ESTA es la que lee la pantalla.**
-- Se parte de su definición viva y se cambia SOLO el monto de la rama de Store;
-- la rama de Premium queda intacta, letra por letra. Las columnas de salida no
-- cambian de nombre, orden ni tipo, así que `create or replace` la acepta.
create or replace view public.bitacora_comercial_view with (security_invoker=true) as
 select 'store'::text as modulo,
    p.id,
    (p.id)::text as destino_id,
    p.folio_oc as folio,
    p.created_at as fecha,
    p.usuario_id as solicitante_id,
    sol.nombre_completo as solicitante_nombre,
    sol.oficina_id,
    ofi.nombre as oficina_nombre,
    resp.nombre_completo as responsable_nombre,
    coalesce(d.cantidad_total, (0)::bigint) as cantidad,
    (coalesce(d.monto_total, (0)::numeric) + coalesce(c.cargos, (0)::numeric)) as monto,
    p.forma_pago,
    (p.metodo_pago)::text as metodo_pago,
    coalesce(pg.pagado, (0)::numeric) as pagado,
    ((coalesce(d.monto_total, (0)::numeric) + coalesce(c.cargos, (0)::numeric)) - coalesce(pg.pagado, (0)::numeric)) as saldo,
    true as activo,
    null::text as plan,
        case
            when ((coalesce(d.monto_total, (0)::numeric) + coalesce(c.cargos, (0)::numeric)) = (0)::numeric) then 'sin_monto'::text
            when (abs((coalesce(pg.pagado, (0)::numeric) - (coalesce(d.monto_total, (0)::numeric) + coalesce(c.cargos, (0)::numeric)))) <= 0.01) then 'al_corriente'::text
            when (coalesce(pg.pagado, (0)::numeric) > (coalesce(d.monto_total, (0)::numeric) + coalesce(c.cargos, (0)::numeric))) then 'a_favor'::text
            else 'debe'::text
        end as estado_pago
   from (((((public.store_pedidos p
     left join public.usuarios sol on ((sol.id = p.usuario_id)))
     left join public.oficinas ofi on ((ofi.id = sol.oficina_id)))
     left join public.usuarios resp on ((resp.id = p.responsable_pago_id)))
     left join ( select store_pedidos_detalle.pedido_id,
            sum(store_pedidos_detalle.cantidad) as cantidad_total,
            sum(((store_pedidos_detalle.cantidad)::numeric * store_pedidos_detalle.precio_unitario)) as monto_total
           from public.store_pedidos_detalle
          group by store_pedidos_detalle.pedido_id) d on ((d.pedido_id = p.id)))
     left join ( select store_pedido_pagos.pedido_id,
            sum(store_pedido_pagos.monto) as pagado
           from public.store_pedido_pagos
          group by store_pedido_pagos.pedido_id) pg on ((pg.pedido_id = p.id)))
     left join ( select store_pedido_cargos.pedido_id,
            sum(store_pedido_cargos.monto) as cargos
           from public.store_pedido_cargos
          group by store_pedido_cargos.pedido_id) c on ((c.pedido_id = p.id))
union all
 select 'premium'::text as modulo,
    per.id,
    (per.usuario_id)::text as destino_id,
    per.folio,
    (per.fecha_inicio)::timestamp with time zone as fecha,
    per.usuario_id as solicitante_id,
    u.nombre_completo as solicitante_nombre,
    u.oficina_id,
    ofi.nombre as oficina_nombre,
    u.nombre_completo as responsable_nombre,
    1 as cantidad,
    mkt_premium_monto_periodo(per.plan) as monto,
    coalesce(per.frecuencia_pago, per.plan) as forma_pago,
    per.metodo_pago,
    coalesce(pg.pagado, (0)::numeric) as pagado,
    (mkt_premium_monto_periodo(per.plan) - coalesce(pg.pagado, (0)::numeric)) as saldo,
    (per.fecha_fin is null) as activo,
    per.plan,
        case
            when (per.plan is null) then 'sin_plan'::text
            when (abs((coalesce(pg.pagado, (0)::numeric) - mkt_premium_monto_periodo(per.plan))) <= 0.01) then 'al_corriente'::text
            when (coalesce(pg.pagado, (0)::numeric) > mkt_premium_monto_periodo(per.plan)) then 'a_favor'::text
            else 'debe'::text
        end as estado_pago
   from (((public.mkt_premium_periodos per
     left join public.usuarios u on ((u.id = per.usuario_id)))
     left join public.oficinas ofi on ((ofi.id = u.oficina_id)))
     left join ( select mkt_premium_pagos.periodo_id,
            sum(mkt_premium_pagos.monto) as pagado
           from public.mkt_premium_pagos
          where (mkt_premium_pagos.periodo_id is not null)
          group by mkt_premium_pagos.periodo_id) pg on ((pg.periodo_id = per.id)));

-- 4b. `store_bitacora_view` — hoy no la lee el frontend, pero existe y tiene
-- permisos propios, así que se deja correcta en vez de medio actualizada.
-- Va `drop` y no `create or replace` porque la columna `costo_envio` que se
-- agregó esta mañana desaparece, y `create or replace view` **no deja quitar ni
-- renombrar** columnas de salida, solo agregar al final.
drop view if exists public.store_bitacora_view;

create view public.store_bitacora_view with (security_invoker=true) as
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
  b.articulos,
  b.cargos
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
    coalesce(c.cargos, 0::numeric)                as cargos,
    -- EL total del pedido, escrito una sola vez.
    coalesce(d.monto_total, 0::numeric) + coalesce(c.cargos, 0::numeric) as monto,
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
    left join (
      select pedido_id, sum(monto) as cargos
        from public.store_pedido_cargos
       group by pedido_id
    ) c on c.pedido_id = p.id
) b;

comment on view public.store_bitacora_view is
  'Bitácora de MOVI Store: una fila por pedido. `monto` = artículos + cargos al cliente (store_pedido_cargos). security_invoker=true: hereda la RLS real de cada tabla. OJO: la pantalla de Bitácora NO lee esta vista, lee bitacora_comercial_view.';

-- El `drop` se llevó los permisos de la vista anterior. Se repone SOLO
-- `select`, no los `insert/update/delete` que traía del baseline: es una vista
-- sobre un join con agregados, así que no es actualizable y esos permisos
-- nunca pudieron hacer nada. Conservarlos solo haría creer que sí.
grant select on public.store_bitacora_view to authenticated, anon, service_role;

-- ── 5. Fuera la columna ────────────────────────────────────────────────────
-- Ya está respaldada como renglones en el paso 3, y las dos vistas dejaron de
-- mirarla en el paso 4.

alter table public.store_pedidos drop column if exists costo_envio;

commit;

-- Comprobaciones:
--
-- 1) Lo que había en costo_envio quedó como renglón:
--      select pedido_id, concepto, monto from store_pedido_cargos order by created_at desc limit 10;
--
-- 2) La vista que SÍ lee la pantalla cuadra:
--      select folio, cantidad, monto, pagado, saldo, estado_pago
--        from bitacora_comercial_view where modulo = 'store'
--       order by fecha desc limit 10;
--
-- 3) Y las dos vistas dicen lo mismo del mismo pedido (no debe devolver nada):
--      select b.folio, b.monto as comercial, s.monto as store
--        from bitacora_comercial_view b
--        join store_bitacora_view s on s.id = b.id
--       where b.modulo = 'store' and b.monto <> s.monto;
--
-- Si la Bitácora dice "Could not find the table … in the schema cache":
--      notify pgrst, 'reload schema';
