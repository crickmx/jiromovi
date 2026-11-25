-- ============================================================================
-- Sesiones del Aula Virtual que se quedan pegadas en "en vivo"
--
-- Dos estados se corrompen solos: una sesión que ya terminó y nunca se cerró
-- sigue en `en_vivo` (nadie puede editarla ni eliminarla porque la pantalla solo
-- ofrecía acciones para las `programado`), y otra que nunca empezó quedó en
-- `en_vivo` por una prueba.
--
-- Regla:
--   · `en_vivo` con fecha_fin pasada (con 30 min de gracia) y sin nadie dentro
--     → `finalizado`, con los enlaces apagados.
--   · `en_vivo` con la fecha_fin de hace más de 4 horas → `finalizado` aunque
--     queden filas de participantes abiertas: quien cierra la pestaña nunca
--     marca su salida, y si no, la sesión no se cierra jamás.
--   · `en_vivo` cuya fecha_inicio está a más de 2 horas → no ha empezado:
--     vuelve a `programado`.
-- ============================================================================

create or replace function public.aula_cerrar_sesiones_vencidas()
returns table (finalizadas integer, reprogramadas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  n_fin integer := 0;
  n_prog integer := 0;
begin
  with cerradas as (
    update aula_eventos e
       set estado = 'finalizado',
           link_activo = false
     where e.estado = 'en_vivo'
       and e.fecha_fin is not null
       and e.fecha_fin < now() - interval '30 minutes'
       and (
         e.fecha_fin < now() - interval '4 hours'
         or not exists (
           select 1 from aula_participantes p
            where p.evento_id = e.id and p.salido_at is null
         )
       )
    returning 1
  )
  select count(*) into n_fin from cerradas;

  -- Quien cerró el navegador sin salir deja la fila abierta para siempre.
  update aula_participantes p
     set salido_at = coalesce(
           (select e.fecha_fin from aula_eventos e where e.id = p.evento_id),
           now()
         )
   where p.salido_at is null
     and exists (
       select 1 from aula_eventos e
        where e.id = p.evento_id
          and e.estado = 'finalizado'
          and coalesce(e.fecha_fin, now()) < now() - interval '30 minutes'
     );

  with reprogramadas as (
    update aula_eventos e
       set estado = 'programado',
           link_activo = true
     where e.estado = 'en_vivo'
       and e.fecha_inicio is not null
       and e.fecha_inicio > now() + interval '2 hours'
    returning 1
  )
  select count(*) into n_prog from reprogramadas;

  return query select n_fin, n_prog;
end;
$$;

grant execute on function public.aula_cerrar_sesiones_vencidas() to authenticated, service_role;

-- Primera pasada: arregla lo que ya está atascado.
select * from public.aula_cerrar_sesiones_vencidas();

-- Y cada 10 minutos, para que no vuelva a acumularse.
select cron.unschedule('aula-cerrar-vencidas')
 where exists (select 1 from cron.job where jobname = 'aula-cerrar-vencidas');

select cron.schedule(
  'aula-cerrar-vencidas',
  '*/10 * * * *',
  $$select public.aula_cerrar_sesiones_vencidas()$$
);