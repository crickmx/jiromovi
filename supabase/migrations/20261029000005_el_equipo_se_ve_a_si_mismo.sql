-- QA 2026-10-22 (A8) · Las @menciones vuelven a sugerir gente
--
-- El reporte decía "las @menciones no sugieren a nadie" y proponía revisar la
-- consulta del autocompletado. La consulta está bien. Lo que está mal es la RLS.
--
-- `tramites_grupos_miembros` tiene UNA sola política de lectura:
--
--     usuario_id = auth.uid()  OR  rol = 'Administrador'
--
-- O sea que un Empleado, un Gerente o un ejecutivo solo puede ver **su propia
-- fila**. El autocompletado pide los miembros del equipo del trámite, recibe
-- una sola fila —la suya—, y la descarta porque uno no se menciona a sí mismo.
-- Resultado: lista vacía, siempre, para todo el mundo menos un Administrador.
-- **Las @menciones nunca han funcionado para nadie más.**
--
-- Es el patrón #1 del proyecto otra vez: acceso por equipo que solo llega a una
-- mitad. El frontend da por hecho que puedes ver a tu propio equipo; la base
-- dice que solo a ti mismo.
--
-- **Esto no es solo las menciones.** La misma tabla la leen la lista de
-- miembros del detalle (`TramiteDetalles`), el conteo de integrantes de "Mi
-- equipo" (`PanelLider`, que por esto cuenta 1 siempre) y los contactos del
-- correo. Todas ven lo mismo: nada.
--
-- Se AGREGA una política, no se toca la que existe: en Postgres las permisivas
-- se combinan con OR, así que sumar una solo puede abrir lo que falta.

begin;

set local lock_timeout = '5s';

-- `get_my_grupo_ids()` es SECURITY DEFINER, así que su consulta interna a esta
-- misma tabla NO vuelve a pasar por esta política: no hay recursión. Es el
-- mismo recurso que ya usan `tickets_select_v9` y `es_reporte_de_bug`.
drop policy if exists tramites_grupos_miembros_select_mi_equipo on public.tramites_grupos_miembros;
create policy tramites_grupos_miembros_select_mi_equipo
  on public.tramites_grupos_miembros for select to authenticated
  using (grupo_id = any (public.get_my_grupo_ids()));

comment on policy tramites_grupos_miembros_select_mi_equipo on public.tramites_grupos_miembros is
  'Ver a los compañeros de los equipos a los que uno pertenece. Sin esto, el autocompletado de @menciones y la lista de miembros del equipo salen vacíos para todo el que no sea Administrador.';

commit;

-- Reversa (solo si algo falla):
-- begin;
-- drop policy if exists tramites_grupos_miembros_select_mi_equipo on public.tramites_grupos_miembros;
-- commit;
