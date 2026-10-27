-- Una sola tabla para las cotizaciones de todos los cotizadores de MOVI.
--
-- Antes cada cotizador guardaba (o no) por su cuenta: solo el Multicotizador
-- GMM guardaba, en multicotizador_gmm_quotes, con su propia pestaña. Ahora la
-- página Cotizar › Cotizaciones lista, abre, edita, reenvía y elimina las de
-- cualquier cotizador desde aquí.
--
-- Decisiones de Ricardo (27/10):
--   * Visibilidad: cada quien las suyas; el Gerente las de los usuarios de sus
--     oficinas (principal + adicionales); el Administrador todas.
--   * Editar actualiza el mismo folio (no crea uno nuevo).
--   * Las 32 del Multicotizador GMM se pasan con su mismo folio MGMM-….
--
-- ⚠️ La base es la misma para beta y producción. Producción sigue escribiendo
-- en multicotizador_gmm_quotes hasta que reciba el código nuevo; el trigger
-- trg_gmm_quotes_a_cotizaciones copia esas altas aquí para que no se pierdan.

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  -- 'gmm_multi' (Multicotizador GMM) | 'auna_onco' (Auna Oncosalud Plus)
  cotizador text not null,
  -- Sin FK a usuarios: hay cotizaciones GMM de una cuenta que ya no existe.
  usuario_id uuid not null default auth.uid(),
  cliente_nombre text not null default '',
  cliente_email text,
  cliente_telefono text,
  -- El estado completo del cotizador, para reabrir y regenerar el PDF.
  datos jsonb not null default '{}'::jsonb,
  -- Lo que la lista muestra sin abrir: aseguradoras, forma de pago, etc.
  resumen jsonb not null default '{}'::jsonb,
  prima_total numeric,
  -- Bitácora de envíos: [{canal, destino, at, usuario_id}]
  envios jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists cotizaciones_usuario_idx on public.cotizaciones (usuario_id, created_at desc) where deleted_at is null;
create index if not exists cotizaciones_cotizador_idx on public.cotizaciones (cotizador, created_at desc) where deleted_at is null;

-- ── Folio por cotizador ──────────────────────────────────────────────────────
-- GMM conserva su contador (MGMM-AAAA-00001) para no chocar con los que ya
-- existen. Los demás: PREFIJO-AAAA-00001 con su propio contador.
create table if not exists public.cotizaciones_folio_contador (
  prefijo text not null,
  anio integer not null,
  ultimo integer not null default 0,
  primary key (prefijo, anio)
);
alter table public.cotizaciones_folio_contador enable row level security;

create or replace function public.cotizaciones_asignar_folio()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_prefijo text;
  v_anio integer := extract(year from now())::integer;
  v_num integer;
begin
  if new.folio is not null and new.folio <> '' then
    return new;
  end if;
  if new.cotizador = 'gmm_multi' then
    new.folio := generate_multicotizador_gmm_folio();
    return new;
  end if;
  v_prefijo := case new.cotizador when 'auna_onco' then 'AUNA' else upper(left(new.cotizador, 6)) end;
  insert into cotizaciones_folio_contador (prefijo, anio, ultimo)
  values (v_prefijo, v_anio, 1)
  on conflict (prefijo, anio) do update set ultimo = cotizaciones_folio_contador.ultimo + 1
  returning ultimo into v_num;
  new.folio := v_prefijo || '-' || v_anio || '-' || lpad(v_num::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists trg_cotizaciones_folio on public.cotizaciones;
create trigger trg_cotizaciones_folio
  before insert on public.cotizaciones
  for each row execute function public.cotizaciones_asignar_folio();

create or replace function public.cotizaciones_tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_cotizaciones_updated_at on public.cotizaciones;
create trigger trg_cotizaciones_updated_at
  before update on public.cotizaciones
  for each row execute function public.cotizaciones_tocar_updated_at();

-- ── Visibilidad ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER para leer usuarios sin depender de su RLS.
create or replace function public.puede_ver_cotizacion(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    p_usuario_id = auth.uid()
    or exists (select 1 from usuarios yo where yo.id = auth.uid() and yo.rol = 'Administrador')
    or exists (
      select 1
      from usuarios yo
      join usuarios dueno on dueno.id = p_usuario_id
      where yo.id = auth.uid()
        and yo.rol = 'Gerente'
        and dueno.oficina_id is not null
        and (
          dueno.oficina_id = yo.oficina_id
          or exists (
            select 1 from usuario_oficinas_adicionales ad
            where ad.usuario_id = yo.id and ad.oficina_id = dueno.oficina_id
          )
        )
    );
$$;

revoke all on function public.puede_ver_cotizacion(uuid) from public, anon;
grant execute on function public.puede_ver_cotizacion(uuid) to authenticated;

alter table public.cotizaciones enable row level security;

drop policy if exists cotizaciones_select on public.cotizaciones;
create policy cotizaciones_select on public.cotizaciones
  for select to authenticated
  using (deleted_at is null and public.puede_ver_cotizacion(usuario_id));

drop policy if exists cotizaciones_insert on public.cotizaciones;
create policy cotizaciones_insert on public.cotizaciones
  for insert to authenticated
  with check (usuario_id = auth.uid());

-- Editar, reenviar o eliminar (soft delete) lo puede quien la ve; el dueño no cambia.
drop policy if exists cotizaciones_update on public.cotizaciones;
create policy cotizaciones_update on public.cotizaciones
  for update to authenticated
  using (deleted_at is null and public.puede_ver_cotizacion(usuario_id))
  with check (public.puede_ver_cotizacion(usuario_id));

revoke all on table public.cotizaciones from anon;
grant select, insert, update on table public.cotizaciones to authenticated;

-- ── Las del Multicotizador GMM ───────────────────────────────────────────────
create or replace function public.gmm_quote_a_cotizacion(q public.multicotizador_gmm_quotes)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into cotizaciones (id, folio, cotizador, usuario_id, cliente_nombre, datos, resumen, created_at, updated_at, deleted_at)
  values (
    q.id, q.folio, 'gmm_multi', q.created_by, coalesce(q.client_name, ''),
    jsonb_build_object(
      'people', coalesce(q.people_json, '[]'::jsonb),
      'options', coalesce(q.options_json, '[]'::jsonb),
      'results', q.results_json,
      'selected_formas_pago', q.selected_formas_pago
    ),
    jsonb_build_object(
      'productos', coalesce((select jsonb_agg(distinct o ->> 'product_id')
                             from jsonb_array_elements(coalesce(q.options_json, '[]'::jsonb)) o
                             where o ->> 'product_id' is not null), '[]'::jsonb),
      'personas', jsonb_array_length(coalesce(q.people_json, '[]'::jsonb))
    ),
    q.created_at, q.updated_at, q.deleted_at
  )
  on conflict (id) do update set
    cliente_nombre = excluded.cliente_nombre,
    datos = excluded.datos,
    resumen = excluded.resumen,
    deleted_at = excluded.deleted_at;
end;
$$;

-- Puente para producción mientras siga escribiendo en la tabla vieja. Nunca
-- debe tumbar el guardado de una cotización: si falla, solo avisa en el log.
create or replace function public.trg_gmm_quotes_a_cotizaciones()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  begin
    perform gmm_quote_a_cotizacion(new);
  exception when others then
    raise warning 'gmm_quote_a_cotizacion % falló: %', new.folio, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_gmm_quotes_a_cotizaciones on public.multicotizador_gmm_quotes;
create trigger trg_gmm_quotes_a_cotizaciones
  after insert or update on public.multicotizador_gmm_quotes
  for each row execute function public.trg_gmm_quotes_a_cotizaciones();

-- Backfill
select public.gmm_quote_a_cotizacion(q) from public.multicotizador_gmm_quotes q;
