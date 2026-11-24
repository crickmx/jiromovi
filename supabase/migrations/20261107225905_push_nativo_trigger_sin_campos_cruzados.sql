-- Corrige 20261107225844 a los 21 segundos de correrla (sin errores registrados
-- en ese lapso). El trigger sirve a dos tablas con columnas distintas
-- (notificaciones.usuario_id / notifications.user_id): leer new.user_id sobre
-- `notificaciones` falla en PL/pgSQL aunque esté dentro de un CASE, y fallaba en
-- el DECLARE, fuera del bloque que atrapa errores — o sea, habría impedido
-- guardar avisos de quien tuviera un teléfono registrado.
-- Ahora el dueño se lee por JSON y TODO va dentro del bloque que atrapa errores:
-- un fallo del push nunca debe impedir guardar el aviso.
create or replace function public.push_nativo_por_notificacion()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_fila jsonb;
  v_usuario uuid;
begin
  begin
    v_fila := to_jsonb(new);
    v_usuario := coalesce(v_fila->>'usuario_id', v_fila->>'user_id')::uuid;
    if v_usuario is null
       or not exists (select 1 from public.push_dispositivos d where d.auth_user_id = v_usuario) then
      return new;
    end if;
    perform net.http_post(
      url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/enviar-push-nativo',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('tabla', tg_table_name, 'id', new.id)
    );
  exception when others then
    raise warning 'push nativo no enviado: %', sqlerrm;
  end;
  return new;
end;
$$;
