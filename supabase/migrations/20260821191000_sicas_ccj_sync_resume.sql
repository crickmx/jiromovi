alter table public.sicas_ccj_report_runs
  add column if not exists retry_count smallint not null default 0
    check (retry_count between 0 and 10);

comment on column public.sicas_ccj_report_runs.retry_count is
  'Reintentos consecutivos de la página actual ante cortes temporales de SICAS.';
