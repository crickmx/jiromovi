-- QA 2026-10-22 (A2) · El equipo puede operar sus propios trámites
--
-- Christofer hizo la LECTURA por equipo el 23/10 (`20261023000001`), y ahí dejó
-- escrito que no tocaba la escritura. Esta es esa mitad.
--
-- **El diagnóstico, leído de `pg_policies` real:**
--
-- 1. `ticket_asignaciones` tiene tres políticas de escritura y **las tres
--    exigen rol Administrador o Gerente**. Un Empleado no puede insertar nunca,
--    aunque sea ejecutivo del equipo dueño del trámite. Ese es el 403 que vio
--    el QA al intentar "asignarse".
--
-- 2. `tickets` tiene **tres políticas de UPDATE superpuestas**
--    (`tickets_update_by_role`, `..._by_role_or_participant`, `..._policy`), y
--    todas deciden por **oficina**, no por equipo. Desde el 23/10 un Empleado
--    VE los trámites de sus equipos pero solo puede ESCRIBIR en los de su
--    oficina: ve trabajo que no puede tocar.
--
-- Es el patrón #1 de este proyecto otra vez —acceso por equipo que solo llega a
-- una mitad—, nada más que aquí la mitad que faltaba era la de escritura.
--
-- **Se AGREGA una política, no se reescriben las tres.** En Postgres las
-- políticas permisivas se combinan con OR, así que sumar una solo puede abrir
-- lo que falta: no hay forma de romper lo que hoy funciona. Consolidar esas
-- tres —que vale la pena, y mucho— es su propio trabajo y su propio riesgo.
--
-- **Límite deliberado:** el `with check` exige que el trámite SIGA en un equipo
-- del usuario. O sea que un miembro puede asignarse, cambiar prioridad, estatus
-- y fechas, pero **no mover el trámite a otro equipo** — eso sigue siendo de
-- Administrador o Gerente. Mover algo fuera de tu propio alcance es una acción
-- de otra naturaleza, y un `with check` permisivo aquí relajaría de paso las
-- restricciones de las otras tres políticas, porque el `with check` final
-- también es un OR.

begin;

set local lock_timeout = '5s';

-- 1. Escribir en los trámites de mis equipos --------------------------------------

drop policy if exists tickets_update_por_equipo on public.tickets;
create policy tickets_update_por_equipo on public.tickets for update to authenticated
  using (
    grupo_asignado_id is not null
    and grupo_asignado_id = any (public.get_my_grupo_ids())
  )
  with check (
    grupo_asignado_id is not null
    and grupo_asignado_id = any (public.get_my_grupo_ids())
  );

comment on policy tickets_update_por_equipo on public.tickets is
  'Un miembro del equipo asignado puede operar el trámite (asignarse, prioridad, estatus). Mover el trámite a OTRO equipo no: para eso está el with check. Complementa las tres políticas por oficina, que se combinan con OR.';

-- 2. Tomar un trámite del pool de mi equipo ---------------------------------------
--
-- El frontend solo INSERTA en esta tabla (tres lugares: tomar del pool, asignar
-- a alguien desde el tablero, y asignar desde el detalle). No actualiza ni
-- borra, así que no hace falta abrir UPDATE ni DELETE.
--
-- `asignado_por = auth.uid()` se exige igual que en la política de staff que ya
-- existe: queda constancia de quién asignó, y nadie puede firmar por otro.

drop policy if exists ticket_asignaciones_insert_equipo on public.ticket_asignaciones;
create policy ticket_asignaciones_insert_equipo on public.ticket_asignaciones for insert to authenticated
  with check (
    asignado_por = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_asignaciones.ticket_id
        and t.grupo_asignado_id is not null
        and t.grupo_asignado_id = any (public.get_my_grupo_ids())
    )
  );

comment on policy ticket_asignaciones_insert_equipo on public.ticket_asignaciones is
  'Un miembro del equipo asignado puede registrar la asignación de un trámite de su equipo. La subconsulta a tickets pasa por la RLS de tickets, así que no abre nada que el usuario no pueda ver.';

commit;

-- Reversa (solo si algo falla):
-- begin;
-- drop policy if exists tickets_update_por_equipo on public.tickets;
-- drop policy if exists ticket_asignaciones_insert_equipo on public.ticket_asignaciones;
-- commit;
