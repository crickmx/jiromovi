-- Perfil "Desarrollador" (Froilán) -- Opción A acordada con Ricardo 2026-11-05:
-- puede ver y probar TODAS las funciones del sistema, manipular libremente
-- usuarios de prueba (es_bot = true), pero de usuarios REALES no ve ni una
-- fila con datos personales o financieros -- no se trata de enmascarar
-- columnas, es que esas filas simplemente no existen para su sesión.
--
-- Se implementa como una columna booleana nueva, exactamente el mismo molde
-- que ya tiene usuarios.es_bot, en vez de un 5º valor de usuarios.rol: ese
-- CHECK y los ~15 archivos que comparan contra los 4 roles base no se tocan.
-- El Desarrollador conserva rol = 'Empleado' (el más restringido de los no
-- admin) y esta columna le SUMA permisos encima, nunca destapa los que ya
-- tenía Administrador/Gerente.

begin;

set local lock_timeout = '5s';

-- ── 1. La columna, protegida igual que es_bot ───────────────────────────────

alter table public.usuarios
  add column if not exists es_desarrollador boolean not null default false;

comment on column public.usuarios.es_desarrollador is
  'Ve y puede probar todos los módulos, pero solo tiene acceso de datos completo sobre usuarios con es_bot=true. Solo un Administrador puede activarla (ver proteger_campos_usuario()).';

-- Esta tabla da GRANT columna por columna (ver usuarioColumnas.ts) -- sin
-- esto nadie, ni el dueño de la fila, podría leer la columna nueva.
grant select (es_desarrollador) on public.usuarios to authenticated;

-- proteger_campos_usuario() ya protege a es_bot contra auto-asignación; se
-- reemplaza entera para sumar es_desarrollador a la misma lista de columnas
-- (ver 20261023000002_proteger_rol_usuarios.sql -- esta es una copia de esa
-- función con una sola columna añadida en cada punto donde aparecía es_bot).

create or replace function public.proteger_campos_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mi_rol            text;
  v_soy_desarrollador boolean;
  v_base_nva          text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if new.rol                        is not distinct from old.rol
     and new.rol_id                 is not distinct from old.rol_id
     and new.estado                 is not distinct from old.estado
     and new.activo                 is not distinct from old.activo
     and new.oficina_id             is not distinct from old.oficina_id
     and new.is_deleted             is not distinct from old.is_deleted
     and new.deleted_at             is not distinct from old.deleted_at
     and new.deleted_by_user_id     is not distinct from old.deleted_by_user_id
     and new.es_bot                 is not distinct from old.es_bot
     and new.es_desarrollador       is not distinct from old.es_desarrollador
     and new.seguros_express_habilitado is not distinct from old.seguros_express_habilitado
  then
    return new;
  end if;

  select u.rol, u.es_desarrollador into v_mi_rol, v_soy_desarrollador
  from public.usuarios u where u.id = auth.uid();

  if v_mi_rol = 'Administrador' then
    return new;
  end if;

  -- Un Desarrollador puede reconfigurar rol/oficina/estado de un usuario de
  -- PRUEBA (la fila ya era bot antes del cambio) para montar escenarios --
  -- pero no puede usar esto para volverse admin, quitarle la marca de bot,
  -- auto-nombrarse desarrollador, ni dar de baja a nadie.
  if v_soy_desarrollador and old.es_bot = true and new.id <> auth.uid() then
    if new.rol = 'Administrador' then
      raise exception 'Un Desarrollador no puede volver Administrador a un usuario de prueba'
        using errcode = '42501';
    end if;
    if new.es_bot is distinct from old.es_bot then
      raise exception 'Un Desarrollador no puede quitarle la marca de prueba a un usuario'
        using errcode = '42501';
    end if;
    if new.es_desarrollador is distinct from old.es_desarrollador
       or new.is_deleted             is distinct from old.is_deleted
       or new.deleted_at             is distinct from old.deleted_at
       or new.deleted_by_user_id     is distinct from old.deleted_by_user_id
       or new.seguros_express_habilitado is distinct from old.seguros_express_habilitado then
      raise exception 'Un Desarrollador no puede cambiar esa columna, ni siquiera en un usuario de prueba'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if v_mi_rol = 'Gerente' and new.id <> auth.uid() then
    select r.rol_base into v_base_nva from public.roles r where r.id = new.rol_id;

    if old.rol in ('Administrador', 'Gerente') then
      raise exception 'Un Gerente no puede modificar a otro Gerente o Administrador'
        using errcode = '42501';
    end if;
    if not (old.oficina_id = any (public.get_my_oficina_ids())) then
      raise exception 'Un Gerente solo puede modificar usuarios de su oficina'
        using errcode = '42501';
    end if;
    if new.rol not in ('Empleado', 'Agente')
       or (new.rol_id is not null and coalesce(v_base_nva, '') not in ('Empleado', 'Agente')) then
      raise exception 'Un Gerente solo puede asignar roles con base Empleado o Agente'
        using errcode = '42501';
    end if;
    if new.oficina_id is distinct from old.oficina_id
       and not (new.oficina_id = any (public.get_my_oficina_ids())) then
      raise exception 'Un Gerente solo puede mover usuarios entre sus oficinas'
        using errcode = '42501';
    end if;
    if new.is_deleted             is distinct from old.is_deleted
       or new.deleted_at          is distinct from old.deleted_at
       or new.deleted_by_user_id  is distinct from old.deleted_by_user_id
       or new.es_bot              is distinct from old.es_bot
       or new.es_desarrollador    is distinct from old.es_desarrollador
       or new.seguros_express_habilitado is distinct from old.seguros_express_habilitado then
      raise exception 'Solo un Administrador puede dar de baja, marcar como bot/desarrollador o habilitar Seguros Express'
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'No tienes permiso para cambiar el rol, el estado o la oficina de un usuario'
    using errcode = '42501';
end;
$$;

-- ── 2. Helper para RLS: ¿la sesión actual es un Desarrollador? ──────────────
-- SECURITY DEFINER para no recursionar contra la RLS de usuarios (mismo
-- patrón que get_my_rol()).

create or replace function public.soy_desarrollador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.es_desarrollador from public.usuarios u where u.id = auth.uid()),
    false
  );
$$;

revoke all on function public.soy_desarrollador() from public, anon;
grant execute on function public.soy_desarrollador() to authenticated, service_role;

-- ── 3. La restricción real: filas de usuarios reales, invisibles ───────────
-- RESTRICTIVE: se combina con AND sobre cualquier política permisiva
-- existente. Para quien NO es desarrollador, "not soy_desarrollador()" ya es
-- true y la política no le quita nada -- cero cambio de comportamiento para
-- el resto del sistema.

drop policy if exists "Desarrollador solo ve bots o a si mismo" on public.usuarios;
create policy "Desarrollador solo ve bots o a si mismo"
  on public.usuarios
  as restrictive
  for select
  to authenticated
  using (
    not public.soy_desarrollador()
    or es_bot = true
    or id = auth.uid()
  );

-- ── 4. Mismo candado sobre comisiones ───────────────────────────────────────
-- La migración de hoy (20261105172354) le abrió "Staff can view all
-- commission details/errors" a cualquier Empleado/Gerente/Admin -- un
-- Desarrollador con rol base Empleado calificaría ahí y vería comisiones y
-- nombres de clientes reales. Esta política se lo recorta a solo las
-- comisiones de usuarios bot (o las propias, por si algún día el
-- Desarrollador tiene comisión real, aunque hoy Froilán no la tendría).

drop policy if exists "Desarrollador solo ve comisiones de bots" on public.commission_details;
create policy "Desarrollador solo ve comisiones de bots"
  on public.commission_details
  as restrictive
  for select
  to authenticated
  using (
    not public.soy_desarrollador()
    or usuario_id = auth.uid()
    or exists (
      select 1 from public.usuarios u
      where u.id = commission_details.usuario_id and u.es_bot = true
    )
  );

-- commission_errors no tiene usuario_id (solo email_agente, sin FK) -- se le
-- cierra el acceso de Staff por completo para Desarrollador: no hay forma
-- segura de saber si un error de importación es "de un bot".
drop policy if exists "Desarrollador no ve errores de comisiones" on public.commission_errors;
create policy "Desarrollador no ve errores de comisiones"
  on public.commission_errors
  as restrictive
  for select
  to authenticated
  using (not public.soy_desarrollador());

-- ── 5. Puede manipular bots sin restricción ─────────────────────────────────
-- Simétrico al candado de arriba: si la fila objetivo (OLD, antes del
-- cambio) ya era de un bot, un Desarrollador puede escribir sobre ella como
-- si fuera Administrador. No le da permiso sobre usuarios reales.

drop policy if exists "Desarrollador edita usuarios bot" on public.usuarios;
create policy "Desarrollador edita usuarios bot"
  on public.usuarios
  for update
  to authenticated
  using (public.soy_desarrollador() and es_bot = true)
  with check (public.soy_desarrollador() and es_bot = true);

-- ── 6. Mismo criterio en el lado de la base ─────────────────────────────────
-- tiene_permiso_admin_en_modulo() es la versión en SQL de
-- tienePermisoAdminEnModulo() (permisosUtils.ts) -- la usan RLS de verdad
-- (p.ej. seguros_education), no solo el frontend. Si no se actualiza aquí
-- también, un Desarrollador vería el botón de administrar en el frontend
-- pero la base le rechazaría la escritura.

create or replace function public.tiene_permiso_admin_en_modulo(p_usuario_id uuid, p_modulo_codigo text)
 returns boolean
 language plpgsql
 stable security definer
as $function$
declare
v_rol text;
v_es_desarrollador boolean;
v_tiene_permiso boolean;
begin
select rol, es_desarrollador into v_rol, v_es_desarrollador
from usuarios
where id = p_usuario_id and estado = 'activo';

if v_rol is null then
return false;
end if;

if v_rol = 'Administrador' then
return true;
end if;

if v_es_desarrollador then
return true;
end if;

if v_rol != 'Gerente' then
return false;
end if;

select exists (
select 1
from permisos_adicionales_gerente pag
join modulos_sistema ms on ms.id = pag.modulo_id
where pag.usuario_id = p_usuario_id
and ms.codigo = p_modulo_codigo
and ms.activo = true
) into v_tiene_permiso;

return coalesce(v_tiene_permiso, false);
end;
$function$
;

-- ── 7. Que de verdad VEA todos los módulos en el sidebar ────────────────────
-- useModuleVisibility.ts resuelve por prioridad: user > office > rol_id
-- (catálogo de roles) > role (rol base) > default visible=true. Un módulo
-- SIN ninguna regla ya es visible por default -- lo único que hace falta es
-- destapar los que hoy están ocultos específicamente para 'Empleado', con
-- una regla de mayor prioridad (rol_id) apuntando al nuevo rol del catálogo.
--
-- ⚠️ Si algún módulo también está oculto por una regla de OFICINA para la
-- oficina donde quede Froilán, esa regla gana sobre esta (office > rol_id en
-- la prioridad) -- revisar manualmente si algo no aparece.

insert into public.roles (id, nombre, descripcion, color, rol_base, es_sistema, activo, orden, created_at, updated_at)
select gen_random_uuid(), 'Desarrollador',
       'Prueba todas las funciones del sistema con datos de prueba. No ve información sensible de usuarios reales.',
       '#8b5cf6', 'Empleado', false, true,
       coalesce((select max(orden) + 1 from public.roles), 0),
       now(), now()
where not exists (select 1 from public.roles where nombre = 'Desarrollador');

insert into public.module_visibility (id, module_key, target_type, target_value, visible, updated_at)
select gen_random_uuid(), mv.module_key, 'rol_id', r.id::text, true, now()
from public.module_visibility mv
cross join (select id from public.roles where nombre = 'Desarrollador') r
where mv.target_type = 'role' and mv.target_value = 'Empleado' and mv.visible = false
  and not exists (
    select 1 from public.module_visibility mv2
    where mv2.module_key = mv.module_key and mv2.target_type = 'rol_id' and mv2.target_value = r.id::text
  );

commit;

-- Para activarlo en la cuenta de Froilán, una vez que exista su usuario:
--   update public.usuarios set es_desarrollador = true where id = '<uuid de Froilán>';
--   update public.usuarios set rol_id = (select id from public.roles where nombre = 'Desarrollador')
--     where id = '<uuid de Froilán>';
-- (Admin, desde UserModal -> Oficinas/Rol, puede terminar de ubicarlo en una oficina
-- cualquiera; es_desarrollador es lo único que de verdad cambia sus permisos.)

-- Reversa (solo si algo falla):
-- begin;
-- delete from public.module_visibility where target_type = 'rol_id'
--   and target_value = (select id::text from public.roles where nombre = 'Desarrollador');
-- delete from public.roles where nombre = 'Desarrollador';
-- drop policy if exists "Desarrollador edita usuarios bot" on public.usuarios;
-- drop policy if exists "Desarrollador no ve errores de comisiones" on public.commission_errors;
-- drop policy if exists "Desarrollador solo ve comisiones de bots" on public.commission_details;
-- drop policy if exists "Desarrollador solo ve bots o a si mismo" on public.usuarios;
-- drop function if exists public.soy_desarrollador();
-- alter table public.usuarios drop column if exists es_desarrollador;
-- commit;
