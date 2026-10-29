-- QA 2026-10-22 (A4 y B22) · Un cambio de estatus manda UN aviso, y dice que es de estatus
--
-- Los dos hallazgos son el mismo bug.
--
-- Desde el 27/07 todo cambio manual de estatus exige un comentario, y
-- `confirmarCambioConComentario` lo inserta en `ticket_comentarios` **antes** de
-- guardar el estatus. Eso dispara dos triggers distintos sobre dos tablas
-- distintas:
--
--   · `trigger_notificar_comentario_tramite`  → "Nuevo comentario"
--   · `trigger_notificar_cambio_estatus_tramite` → "Cambio de estatus"
--
-- Resultado: llegan **dos** avisos por una sola acción, y el primero describe
-- algo que el usuario no hizo —nadie comentó, cambió el estatus—. Eso es A4
-- ("salen 2 veces") y B22 ("llega como Nuevo comentario") a la vez.
--
-- La nota sigue guardándose y sigue viéndose en la conversación: para eso se
-- pidió obligatoria. Lo que deja de hacer es generar su propio aviso, porque el
-- del estatus ya cubre la acción.
--
-- Se marca la nota en vez de adivinar. Alternativas que se descartaron:
-- comparar tiempos ("si hubo cambio de estatus hace menos de N segundos") es
-- frágil y falla justo cuando alguien comenta de verdad en ese momento; y
-- apagar el aviso de estatus en vez del de comentario dejaría el aviso menos
-- informativo de los dos.

begin;

set local lock_timeout = '5s';

alter table public.ticket_comentarios
  add column if not exists es_nota_de_estatus boolean not null default false;

comment on column public.ticket_comentarios.es_nota_de_estatus is
  'true = es la nota obligatoria de un cambio de estatus, no un comentario por su cuenta. Se guarda y se ve igual en la conversación, pero no genera su propio aviso: el del cambio de estatus ya lo cubre.';

-- El filtro va en el TRIGGER, no dentro de la función.
--
-- `notificar_comentario_tramite()` tiene medio centenar de líneas y no la
-- escribimos nosotros; un `WHEN` deja la condición a la vista de cualquiera que
-- liste los triggers de la tabla, y no toca el cuerpo de la función.
--
-- Los otros dos triggers de la tabla (`trg_comentario_ultima_accion`,
-- `trigger_log_ticket_comentario`) se quedan **sin filtro** a propósito: la nota
-- sí es una acción sobre el trámite y sí debe entrar al historial.
drop trigger if exists trigger_notificar_comentario_tramite on public.ticket_comentarios;
create trigger trigger_notificar_comentario_tramite
  after insert on public.ticket_comentarios
  for each row
  when (new.es_nota_de_estatus is not true)
  execute function public.notificar_comentario_tramite();

commit;

-- Reversa (solo si algo falla):
-- begin;
-- drop trigger if exists trigger_notificar_comentario_tramite on public.ticket_comentarios;
-- create trigger trigger_notificar_comentario_tramite
--   after insert on public.ticket_comentarios
--   for each row execute function public.notificar_comentario_tramite();
-- -- La columna se puede quedar: sin el WHEN no afecta a nada.
-- commit;
