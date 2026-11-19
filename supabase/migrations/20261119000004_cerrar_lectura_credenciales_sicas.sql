drop policy if exists "Everyone can read sicas_config" on public.sicas_config;
revoke select on public.sicas_config from authenticated;
revoke select on public.sicas_config from anon;
grant select (id, endpoint, last_test_at, last_test_success, last_test_message, last_sync_despachos_at, last_sync_vendedores_at, created_at, updated_at, alternate_report_codes, current_report_code, last_successful_report, use_rest, local_first_mode, auto_sync_enabled, last_successful_local_count, last_successful_historic_report, excluded_report_codes, soap_diagnostic_enabled) on public.sicas_config to authenticated;
