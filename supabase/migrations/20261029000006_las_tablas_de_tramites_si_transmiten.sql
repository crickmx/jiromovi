-- QA 2026-10-22 (A9) · Lo que pasa en un trámite se ve sin recargar
--
-- El reporte lo describió como "los comentarios de otros solo aparecen al
-- recargar", y la sospecha estaba en el patrón frágil de canal sin reintento.
-- **No es eso.**
--
-- Supabase solo transmite los cambios de las tablas que estén en la publicación
-- `supabase_realtime`. En esta base hay TRES:
--
--     contact_center_messages · notificaciones · notifications
--
-- y el frontend se suscribe a más de veinte. `ticket_comentarios`, `tickets`,
-- `ticket_archivos`, `ticket_historial` y `store_pedidos` nunca estuvieron ahí,
-- así que cada `postgres_changes` de Trámites y Store lleva años escuchando un
-- flujo por el que no pasa nada. Ningún reintento arregla un canal que nunca
-- tuvo qué entregar: por eso el síntoma es siempre el mismo —"no se actualiza
-- hasta recargar"— y por eso reaparece cada pocos meses en una pantalla
-- distinta.
--
-- Se agregan solo las de Trámites y Store, que es el alcance de esta revisión.
-- Las demás (chat, WhatsApp, reuniones, multicotizador, maestros) siguen igual
-- y tienen el mismo problema: están listadas al final como referencia.
--
-- **La RLS sigue mandando.** Realtime evalúa las políticas de cada tabla contra
-- el usuario suscrito, así que nadie recibe la fila de un trámite que no podría
-- abrir. Publicar no abre nada.
--
-- **No se toca `REPLICA IDENTITY`** a propósito. En FULL, Postgres escribiría la
-- fila vieja completa al WAL en cada UPDATE de `tickets`, que es la tabla más
-- actualizada del sistema. Con la identidad por llave primaria —la de hoy—
-- llegan igual los INSERT y los UPDATE con la fila nueva, que es lo único que
-- estas pantallas usan. Los borrados de trámite son lógicos (`eliminado_at`),
-- o sea UPDATE, así que tampoco hace falta por ahí.

begin;

-- `ALTER PUBLICATION ... ADD TABLE` truena si la tabla ya es miembro, y esta
-- migración tiene que poder correrse dos veces sin dejar la base a medias.
do $publicar$
declare
  t text;
begin
  foreach t in array array[
    'ticket_comentarios',   -- A9: los comentarios del trámite
    'tickets',              -- el tablero de Trámites y el badge del sidebar
    'ticket_archivos',      -- la pestaña Archivos
    'ticket_historial',     -- la pestaña Historial
    'store_pedidos'         -- el tablero de MOVI Store
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'Publicada: %', t;
    else
      raise notice 'Ya estaba publicada: %', t;
    end if;
  end loop;
end
$publicar$;

commit;

-- Comprobación (debe devolver las cinco):
-- select tablename from pg_publication_tables
--  where pubname = 'supabase_realtime' and schemaname = 'public'
--  order by tablename;

-- Las que siguen SIN publicar, con el mismo síntoma esperándolas. No se tocan
-- aquí porque están fuera de Trámites y Store, pero si alguien reporta "no se
-- actualiza hasta recargar" en alguna de estas pantallas, la causa es esta:
--   chat_mensajes · chats · cc_messages · whatsapp_messages ·
--   whatsapp_conversations · meeting_participants · meeting_chat_messages ·
--   multicotizador_gmm_packages · tariff_packages · status_changes ·
--   maestro_agentes · maestro_gerencias · maestro_despachos ·
--   maestro_adjunto_categorias · contact_center_conversation_modes ·
--   contact_center_assistant_sessions · contact_center_smart_assistant_config

-- Reversa (solo si algo falla):
-- begin;
-- alter publication supabase_realtime drop table public.ticket_comentarios;
-- alter publication supabase_realtime drop table public.tickets;
-- alter publication supabase_realtime drop table public.ticket_archivos;
-- alter publication supabase_realtime drop table public.ticket_historial;
-- alter publication supabase_realtime drop table public.store_pedidos;
-- commit;
