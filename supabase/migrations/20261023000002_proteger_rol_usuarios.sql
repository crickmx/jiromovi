-- QA 2026-10-22 · Nadie se puede subir de rol solo
--
-- Hasta hoy la política "Users can update own profile" dejaba que cualquier usuario con
-- sesión se hiciera un PATCH a su propia fila y se pusiera rol = 'Administrador'. Lo mismo
-- el equipo de Mercadotecnia sobre cualquier usuario, y un Gerente podía subir a alguien
-- de su oficina a Gerente o a Administrador. La pantalla lo impedía; la base no.
--
-- Este trigger hace cumplir en la base las mismas reglas que ya aplica la pantalla
-- (UserModal) y la edge function update-user:
--   · Administrador     → puede cambiar todo.
--   · Gerente           → puede cambiar rol, estado y activo de gente de sus oficinas,
--                         solo a roles con base Empleado o Agente, y sin tocar a otro
--                         Gerente o Administrador.
--   · Todos los demás   → no pueden cambiar las columnas protegidas, ni las propias.
--   · Edge functions con service_role y el SQL Editor → sin cambios (ya validan aparte).
--
-- Columnas protegidas: rol, rol_id, estado, activo, oficina_id, is_deleted, deleted_at,
-- deleted_by_user_id, es_bot, seguros_express_habilitado.
-- Todo lo demás del perfil (teléfono, foto, dirección…) se sigue editando igual.

begin;

set local lock_timeout = '5s';

create or replace function public.proteger_campos_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mi_rol   text;
  v_base_nva text;
begin
  -- Solo aplica a llamadas con sesión de usuario. service_role (edge functions) y el
  -- SQL Editor no traen rol 'authenticated' y ya validan por su cuenta.
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
     and new.seguros_express_habilitado is not distinct from old.seguros_express_habilitado
  then
    return new;
  end if;

  select u.rol into v_mi_rol from public.usuarios u where u.id = auth.uid();

  if v_mi_rol = 'Administrador' then
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
       or new.seguros_express_habilitado is distinct from old.seguros_express_habilitado then
      raise exception 'Solo un Administrador puede dar de baja, marcar como bot o habilitar Seguros Express'
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'No tienes permiso para cambiar el rol, el estado o la oficina de un usuario'
    using errcode = '42501';
end;
$$;

revoke all on function public.proteger_campos_usuario() from public, anon, authenticated;

drop trigger if exists trg_zz_proteger_campos_usuario on public.usuarios;
-- "zz" para que corra después de los demás BEFORE UPDATE (Postgres los ordena por nombre),
-- en particular después de trg_usuarios_default_rol_id, que completa rol_id.
create trigger trg_zz_proteger_campos_usuario
  before update on public.usuarios
  for each row execute function public.proteger_campos_usuario();

commit;

-- Reversa (solo si algo falla):
-- drop trigger if exists trg_zz_proteger_campos_usuario on public.usuarios;
-- drop function if exists public.proteger_campos_usuario();
