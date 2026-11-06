-- Registro de lo que hace un Desarrollador dentro de MOVI.
--
-- Pedido de Ricardo (06/11): poder ver en qué anda Froilán, de la forma más
-- automática posible. Medido antes de construir: **no existía ningún registro
-- de actividad**. `audit_logs` solo guardaba altas y bajas de usuarios
-- (`activate_user`, `deactivate_user`); lo demás vive disperso en
-- `ticket_historial`, `ticket_team_audit_logs` y los logs de notificaciones.
--
-- Se reusa `audit_logs` en vez de inventar una tabla: ya tiene exactamente las
-- columnas que hacen falta (action, performed_by, target_user_id,
-- target_resource_type, target_resource_id, details) y sus índices por
-- `performed_by`.
--
-- ── Tres decisiones, con su porqué ────────────────────────────────────────
--
-- 1. SOLO se registra a quien tiene `es_desarrollador`. Para cualquier otro
--    usuario esto es una lectura por llave primaria y se va. El volumen queda
--    en lo que haga una persona, no en lo que haga la empresa — y se apaga
--    quitando la marca, sin tocar código ni borrar triggers.
--
-- 2. Se guardan los NOMBRES de las columnas que cambiaron, NO sus valores.
--    El perfil Desarrollador existe justamente para que no vea datos de
--    usuarios reales; copiar valores a una bitácora que Ricardo lee después
--    volvería a exponer lo que el diseño protege. Para "qué tocó", el nombre
--    de la columna contesta.
--
-- 3. Solo a profundidad 1 (`pg_trigger_depth`). Lo que interesa es lo que hizo
--    la persona, no las filas que se movieron solas por otros triggers.
--
-- Agregar otra tabla al registro es UN renglón al final de este archivo.

begin;

set local lock_timeout = '5s';

create or replace function public.registrar_actividad_desarrollador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_es_dev    boolean;
  v_fila      jsonb;
  v_id        uuid;
  v_columnas  text[];
begin
  -- Nada que registrar fuera de una sesión de persona (crons, service_role,
  -- migraciones). Esos caminos ya tienen sus propios rastros.
  if coalesce(auth.role(), '') <> 'authenticated' then
    return coalesce(new, old);
  end if;

  -- Solo la acción directa de la persona, no las cascadas de otros triggers.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  select u.es_desarrollador into v_es_dev
  from public.usuarios u
  where u.id = auth.uid();

  if coalesce(v_es_dev, false) = false then
    return coalesce(new, old);
  end if;

  v_fila := to_jsonb(coalesce(new, old));
  v_id   := nullif(v_fila ->> 'id', '')::uuid;

  -- En un UPDATE, qué columnas cambiaron (solo los nombres, ver decisión 2).
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}')
      into v_columnas
    from jsonb_object_keys(to_jsonb(new)) k
    where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k;

    -- Un UPDATE que no cambió nada no es actividad.
    if v_columnas = '{}' then
      return new;
    end if;
  end if;

  insert into public.audit_logs (
    action, performed_by, target_user_id,
    target_resource_type, target_resource_id, details
  )
  values (
    'dev_' || lower(tg_op),
    auth.uid(),
    case when tg_table_name = 'usuarios' then v_id else null end,
    tg_table_name,
    v_id,
    jsonb_strip_nulls(jsonb_build_object(
      'tabla',     tg_table_name,
      'operacion', tg_op,
      'columnas',  to_jsonb(v_columnas)
    ))
  );

  return coalesce(new, old);
end;
$$;

comment on function public.registrar_actividad_desarrollador() is
  'Anota en audit_logs lo que escribe un usuario con es_desarrollador. Solo nombres de columnas, nunca valores.';

-- ── A qué tablas se engancha ───────────────────────────────────────────────
--
-- Se arranca con las que de verdad dicen algo de un desarrollador probando:
-- las personas (puede reconfigurar usuarios de prueba), los trámites, y las
-- TRES del FormBuilder — que es donde más ha mordido el patrón de "pantalla
-- que guarda y no hace nada", así que saber que alguien la tocó vale doble.
--
-- Deliberadamente NO se engancha a todo: una bitácora que registra todo no se
-- lee, y cada trigger es trabajo en cada escritura.

do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios',
    'tickets',
    'ticket_tipos',
    'tramite_tipo_campos',
    'tramite_tipo_secciones'
  ] loop
    execute format(
      'drop trigger if exists trg_actividad_desarrollador on public.%I', t);
    execute format(
      'create trigger trg_actividad_desarrollador
         after insert or update or delete on public.%I
         for each row execute function public.registrar_actividad_desarrollador()', t);
  end loop;
end $$;

commit;

-- Comprobación — debe listar las cinco:
--
--   select c.relname
--     from pg_trigger t join pg_class c on c.oid = t.tgrelid
--    where t.tgname = 'trg_actividad_desarrollador'
--    order by c.relname;
--
-- Y para ver lo registrado (solo desde el SQL Editor o service_role:
-- `audit_logs` no tiene política de SELECT, a propósito):
--
--   select created_at, action, target_resource_type, details -> 'columnas'
--     from audit_logs
--    where action like 'dev\_%'
--    order by created_at desc limit 50;
