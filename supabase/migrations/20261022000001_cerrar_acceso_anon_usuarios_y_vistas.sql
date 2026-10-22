-- QA 2026-10-22 · Acción 1, paso 1: cerrar el acceso sin sesión (rol anon)
--
-- Qué hace:
--   A. Quita a anon todo acceso a 18 vistas que corrían como su dueño (saltando RLS).
--      A las 13 que el front no usa les pone security_invoker para que respeten RLS.
--      Las 5 que el front sí usa (chava_knowledge_access_summary, sicas_cobranza_pendiente,
--      sicas_polizas_vigentes, sicas_renovaciones_proximas, vw_tramites_reporte) solo pierden
--      el acceso anon; su paso a security_invoker va en una migración aparte, probada por rol.
--   B. Quita a anon todo acceso a public.usuarios.
--   C. Reescribe la política anon de oficinas para que no lea usuarios directamente
--      (la usa Registro antes de iniciar sesión). Mismo criterio que antes.
--   D. Deja a anon solo SELECT en oficinas, store_productos, store_categorias y user_web_pages.
--
-- Reversa: ver el bloque comentado al final.

begin;

-- A. Vistas --------------------------------------------------------------------------------

revoke all on public.chava_knowledge_access_summary          from anon;
revoke all on public.historial_notificaciones_unificado      from anon;
revoke all on public.mis_polizas_view                        from anon;
revoke all on public.sicas_cobranza_pendiente                from anon;
revoke all on public.sicas_config_view                       from anon;
revoke all on public.sicas_emitidas_mes_actual               from anon;
revoke all on public.sicas_polizas_vigentes                  from anon;
revoke all on public.sicas_renovaciones_proximas             from anon;
revoke all on public.unified_activity_view                   from anon;
revoke all on public.usuarios_con_telefono_normalizado       from anon;
revoke all on public.usuarios_eliminados                     from anon;
revoke all on public.v_catalogo_notificaciones               from anon;
revoke all on public.v_kpis_cotizacion_emision               from anon;
revoke all on public.vista_comisiones_por_usuario            from anon;
revoke all on public.vista_historial_envios_completo         from anon;
revoke all on public.vista_inconsistencias_mapeo_vendedores  from anon;
revoke all on public.vista_mapeo_usuarios_unificado          from anon;
revoke all on public.vw_tramites_reporte                     from anon;

-- Sin uso en el front: que respeten el RLS de quien consulta.
alter view public.historial_notificaciones_unificado     set (security_invoker = on);
alter view public.mis_polizas_view                       set (security_invoker = on);
alter view public.sicas_config_view                      set (security_invoker = on);
alter view public.sicas_emitidas_mes_actual              set (security_invoker = on);
alter view public.unified_activity_view                  set (security_invoker = on);
alter view public.usuarios_con_telefono_normalizado      set (security_invoker = on);
alter view public.usuarios_eliminados                    set (security_invoker = on);
alter view public.v_catalogo_notificaciones              set (security_invoker = on);
alter view public.v_kpis_cotizacion_emision              set (security_invoker = on);
alter view public.vista_comisiones_por_usuario           set (security_invoker = on);
alter view public.vista_historial_envios_completo        set (security_invoker = on);
alter view public.vista_inconsistencias_mapeo_vendedores set (security_invoker = on);
alter view public.vista_mapeo_usuarios_unificado         set (security_invoker = on);

-- B. usuarios ------------------------------------------------------------------------------

drop policy if exists anon_read_directory_users on public.usuarios;
revoke all on public.usuarios from anon;

-- C. oficinas: misma regla anon, sin leer usuarios desde el rol anon -----------------------

create or replace function public.oficina_tiene_pagina_publicada(p_oficina_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.user_web_pages w on w.user_id = u.id and w.is_published = true
    where u.oficina_id = p_oficina_id
      and u.estado = 'activo'
      and u.web_slug is not null
  );
$$;

revoke all on function public.oficina_tiene_pagina_publicada(uuid) from public;
grant execute on function public.oficina_tiene_pagina_publicada(uuid) to anon, authenticated;

drop policy if exists "Public can view offices of published users" on public.oficinas;
create policy "Public can view offices of published users"
  on public.oficinas for select to anon
  using (public.oficina_tiene_pagina_publicada(id));

-- D. Tablas públicas: anon solo lee --------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger on public.oficinas          from anon;
revoke insert, update, delete, truncate, references, trigger on public.store_productos   from anon;
revoke insert, update, delete, truncate, references, trigger on public.store_categorias  from anon;
revoke insert, update, delete, truncate, references, trigger on public.user_web_pages    from anon;

commit;

-- Reversa (solo si algo falla):
-- grant select on public.usuarios to anon;
-- create policy anon_read_directory_users on public.usuarios for select to anon
--   using ((is_deleted = false) and (estado in ('activo','inactivo','pendiente')));
-- alter view public.<vista> reset (security_invoker);   -- por cada vista de A
-- grant select on public.<vista> to anon;                -- por cada vista de A
-- drop policy "Public can view offices of published users" on public.oficinas;
-- create policy "Public can view offices of published users" on public.oficinas for select to anon
--   using (exists (select 1 from usuarios where usuarios.oficina_id = oficinas.id and usuarios.estado = 'activo'
--     and usuarios.web_slug is not null and exists (select 1 from user_web_pages
--     where user_web_pages.user_id = usuarios.id and user_web_pages.is_published = true)));
