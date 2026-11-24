create extension if not exists pgcrypto with schema extensions;

alter table public.sicas_ccj_report_runs
  drop constraint if exists sicas_ccj_report_runs_report_type_check;
alter table public.sicas_ccj_report_runs
  add constraint sicas_ccj_report_runs_report_type_check
  check (report_type in ('efectuada', 'pendiente'));

alter table public.sicas_ccj_report_runs
  add column if not exists trigger_source text not null default 'automatic'
    check (trigger_source in ('automatic', 'manual', 'initial')),
  add column if not exists inserted_rows integer not null default 0 check (inserted_rows >= 0),
  add column if not exists updated_rows integer not null default 0 check (updated_rows >= 0),
  add column if not exists unchanged_rows integer not null default 0 check (unchanged_rows >= 0),
  add column if not exists deactivated_rows integer not null default 0 check (deactivated_rows >= 0);

create table if not exists public.sicas_ccj_records (
  report_type text not null check (report_type in ('efectuada', 'pendiente')),
  record_key text not null,
  data_hash text not null,
  row_data jsonb not null,
  document text,
  company text,
  vendor text,
  despacho text,
  agent text,
  ramo text,
  subramo text,
  gerencia text,
  report_date date,
  source_page integer not null check (source_page > 0),
  source_index integer not null check (source_index >= 0),
  seen_run_id uuid references public.sicas_ccj_report_runs(id) on delete set null,
  is_active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (report_type, record_key)
);

create index if not exists sicas_ccj_records_report_order
  on public.sicas_ccj_records (report_type, is_active, source_page, source_index);
create index if not exists sicas_ccj_records_document
  on public.sicas_ccj_records (report_type, document);
create index if not exists sicas_ccj_records_report_date
  on public.sicas_ccj_records (report_type, report_date);
create index if not exists sicas_ccj_records_company
  on public.sicas_ccj_records (report_type, company);

create table if not exists public.sicas_ccj_sync_config (
  id boolean primary key default true check (id),
  interval_hours integer not null default 4 check (interval_hours between 1 and 24),
  cron_secret_hash text,
  updated_at timestamptz not null default now()
);

insert into public.sicas_ccj_sync_config (id, interval_hours)
values (true, 4)
on conflict (id) do update set interval_hours = excluded.interval_hours, updated_at = now();

alter table public.sicas_ccj_records enable row level security;
alter table public.sicas_ccj_sync_config enable row level security;
revoke all on table public.sicas_ccj_records from anon, authenticated;
revoke all on table public.sicas_ccj_sync_config from anon, authenticated;
grant select, insert, update, delete on table public.sicas_ccj_records to service_role;
grant select, insert, update, delete on table public.sicas_ccj_sync_config to service_role;

do $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'sicas_ccj_cron_secret'
  limit 1;

  if v_secret is null then
    v_secret := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(v_secret, 'sicas_ccj_cron_secret', 'Token interno para el cron de Reportes SICAS CCJ');
  end if;

  update public.sicas_ccj_sync_config
  set cron_secret_hash = encode(extensions.digest(v_secret, 'sha256'), 'hex'),
      updated_at = now()
  where id = true;
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sicas-ccj-sync-cada-4h') then
    perform cron.unschedule('sicas-ccj-sync-cada-4h');
  end if;

  perform cron.schedule(
    'sicas-ccj-sync-cada-4h',
    '17 */4 * * *',
    $cron$
      select net.http_post(
        url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/sicas-ccj-reports',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets where name = 'sicas_ccj_anon_key' limit 1
          ),
          'apikey', (
            select decrypted_secret from vault.decrypted_secrets where name = 'sicas_ccj_anon_key' limit 1
          ),
          'X-Sicas-CCJ-Cron', (
            select decrypted_secret from vault.decrypted_secrets where name = 'sicas_ccj_cron_secret' limit 1
          )
        ),
        body := '{"action":"scheduledSync"}'::jsonb,
        timeout_milliseconds := 10000
      ) as request_id;
    $cron$
  );
end;
$$;

comment on table public.sicas_ccj_records is
  'Réplica local persistente de cobranza SICAS CCJ con detección de altas y cambios por hash.';
comment on table public.sicas_ccj_sync_config is
  'Configuración protegida de la sincronización automática de Reportes SICAS CCJ.';
