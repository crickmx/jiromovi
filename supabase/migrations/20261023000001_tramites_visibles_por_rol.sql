-- QA 2026-10-22 · Cada rol ve solo los trámites que le corresponden
--
-- Regla (Christofer, 23/10):
--   Administrador  → todos.
--   Gerente        → todo lo de su oficina (principal + adicionales) + lo de sus equipos + lo suyo.
--   Empleado       → todo lo de sus equipos asignados + lo suyo.
--   Agente         → solo lo suyo (lo que pidió, creó o le asignaron).
--   Cualquiera     → los trámites donde lo mencionaron (política tickets_mencionados_select, sin cambios).
--
-- "Lo de su oficina": el creador, el solicitante o quien lo atiende pertenece a esa oficina.
-- Es el mismo criterio que ya usa la política de UPDATE (ticket_in_office).
--
-- Antes:
--   · Gerente veía los 415 trámites del sistema (tickets_select_v9).
--   · Empleado veía comentarios y archivos de TODOS los trámites (can_access_ticket).
--   · Cualquier usuario con sesión leía las respuestas del formulario de TODOS los trámites.
--   · vw_tramites_reporte corría como su dueño: todos veían los 481 trámites del reporte.
--
-- Lo que NO cambia: quién puede crear, editar o borrar (solo lectura en esta migración).
-- Reversa: ver el bloque comentado al final.

begin;

set local lock_timeout = '5s';

-- 1. Oficinas del usuario actual: principal + adicionales ------------------------------

create or replace function public.get_my_oficina_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct x.oficina_id) filter (where x.oficina_id is not null), array[]::uuid[])
  from (
    select u.oficina_id from public.usuarios u where u.id = auth.uid()
    union all
    select a.oficina_id from public.usuario_oficinas_adicionales a where a.usuario_id = auth.uid()
  ) x;
$$;

revoke all on function public.get_my_oficina_ids() from public, anon;
grant execute on function public.get_my_oficina_ids() to authenticated, service_role;

-- 2. ¿El trámite es de alguna de mis oficinas? ---------------------------------------

create or replace function public.ticket_es_de_mis_oficinas(
  p_creado_por uuid, p_agente_id uuid, p_agente_usuario_id uuid,
  p_attending_user_id uuid, p_assigned_to_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id in (p_creado_por, p_agente_id, p_agente_usuario_id, p_attending_user_id, p_assigned_to_user_id)
      and u.oficina_id = any (public.get_my_oficina_ids())
  );
$$;

revoke all on function public.ticket_es_de_mis_oficinas(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.ticket_es_de_mis_oficinas(uuid, uuid, uuid, uuid, uuid) to authenticated, service_role;

-- 3. tickets: la regla por rol ---------------------------------------------------------

drop policy if exists tickets_select_v9 on public.tickets;
drop policy if exists tickets_select_v10 on public.tickets;

create policy tickets_select_v10 on public.tickets for select to authenticated
using (
  public.get_my_rol() = 'Administrador'
  -- Gerente: lo de sus oficinas (los reportes de bug van al equipo que los atiende, no a la oficina)
  or (
    public.get_my_rol() = 'Gerente'
    and not public.es_reporte_de_bug(id)
    and public.ticket_es_de_mis_oficinas(creado_por, agente_id, agente_usuario_id, attending_user_id, assigned_to_user_id)
  )
  -- Lo propio (quien reporta un bug no ve su reporte, igual que en v9)
  or ((agente_id = auth.uid() or creado_por = auth.uid()) and not public.es_reporte_de_bug(id))
  or assigned_to_user_id = auth.uid()
  or agente_usuario_id = auth.uid()
  or attending_user_id = auth.uid()
  -- Todo lo de sus equipos, asignado o no (antes solo el pool sin asignar, salvo el líder)
  or (grupo_asignado_id is not null and grupo_asignado_id = any (public.get_my_grupo_ids()))
);

-- 4. Comentarios y archivos: solo los de trámites que el usuario puede ver --------------
--    Ya existen *_select_via_ticket, que heredan la regla de tickets.
--    Se quitan las que abrían todo a Gerente y a cualquier Empleado.

drop policy if exists ticket_comentarios_select_policy on public.ticket_comentarios;
drop policy if exists ticket_archivos_select_policy on public.ticket_archivos;

-- 5. Respuestas del formulario: leer solo las de trámites visibles ----------------------
--    La política ALL daba lectura a cualquiera con sesión. Se separa: la lectura pasa por
--    tickets; la escritura queda igual que antes para no romper la creación de trámites
--    hijos (se revisa aparte).

drop policy if exists auth_read_respuestas on public.tramite_respuestas;
drop policy if exists auth_write_respuestas on public.tramite_respuestas;

create policy tramite_respuestas_select_via_ticket on public.tramite_respuestas for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = tramite_respuestas.tramite_id));

create policy tramite_respuestas_insert_auth on public.tramite_respuestas for insert to authenticated
  with check (auth.uid() is not null);
create policy tramite_respuestas_update_auth on public.tramite_respuestas for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy tramite_respuestas_delete_auth on public.tramite_respuestas for delete to authenticated
  using (auth.uid() is not null);

-- 6. Reporte de trámites: que respete la regla de quien consulta -----------------------

alter view public.vw_tramites_reporte set (security_invoker = on);

commit;

-- Reversa (solo si algo falla):
-- begin;
-- drop policy tickets_select_v10 on public.tickets;
-- create policy tickets_select_v9 on public.tickets for select to authenticated using (
--   (get_my_rol() = any (array['Administrador','Gerente']))
--   or ((agente_id = auth.uid()) and not es_reporte_de_bug(id))
--   or ((creado_por = auth.uid()) and not es_reporte_de_bug(id))
--   or (assigned_to_user_id = auth.uid()) or (agente_usuario_id = auth.uid()) or (attending_user_id = auth.uid())
--   or ((assigned_to_user_id is null) and (attending_user_id is null) and (grupo_asignado_id is not null)
--       and (grupo_asignado_id = any (get_my_grupo_ids())))
--   or ((grupo_asignado_id is not null) and (grupo_asignado_id = any (get_my_grupos_lider_ids()))));
-- create policy ticket_comentarios_select_policy on public.ticket_comentarios for select to authenticated
--   using (is_admin_or_manager() or can_access_ticket(ticket_id));
-- create policy ticket_archivos_select_policy on public.ticket_archivos for select to authenticated
--   using (is_admin_or_manager() or can_access_ticket(ticket_id));
-- drop policy tramite_respuestas_select_via_ticket on public.tramite_respuestas;
-- drop policy tramite_respuestas_insert_auth on public.tramite_respuestas;
-- drop policy tramite_respuestas_update_auth on public.tramite_respuestas;
-- drop policy tramite_respuestas_delete_auth on public.tramite_respuestas;
-- create policy auth_read_respuestas on public.tramite_respuestas for select using (auth.uid() is not null);
-- create policy auth_write_respuestas on public.tramite_respuestas for all using (auth.uid() is not null);
-- alter view public.vw_tramites_reporte reset (security_invoker);
-- commit;
