alter table public.sicas_ccj_report_runs
  add column if not exists worker_token uuid,
  add column if not exists lease_until timestamptz;

create index if not exists sicas_ccj_report_runs_active_lease
  on public.sicas_ccj_report_runs (status, lease_until)
  where status in ('queued', 'running');

comment on column public.sicas_ccj_report_runs.lease_until is
  'Bloqueo temporal que evita procesar la misma pagina SICAS en paralelo.';
