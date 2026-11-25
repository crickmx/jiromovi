-- WhatsApp personal: que la bandeja no se llene de chats vacíos y que la vista
-- previa salga siempre que el chat tenga historial.
--
-- 1) wa_ultimos_mensajes devolvía el ÚLTIMO mensaje tal cual. Si era multimedia
--    o uno de los miles que el servidor guardó como '[unknown]', la lista decía
--    “Sin mensajes” aunque el chat tuviera cientos. Ahora devuelve el último
--    mensaje *legible* (o el tipo, si lo último fue audio/imagen).
-- 2) Al emparejar de nuevo, el servidor crea una conversación por JID que ve
--    —aunque no llegue a guardar ni un mensaje— con `last_message_at = now()`.
--    Esos residuos suben al tope de la lista y desplazan a los chats reales.
--    Se les quita la fecha para que ordenen al final; la pantalla además los
--    filtra.

begin;

create or replace function public.wa_ultimos_mensajes(p_ids uuid[])
returns table(
  conversation_id uuid,
  contenido text,
  tipo text,
  creado timestamp with time zone,
  nombre_sugerido text
)
language sql
stable
set search_path to 'public', 'extensions', 'pg_temp'
as $$
  with ultimo as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.message_type,
      coalesce(m.message_timestamp, m.created_at) as creado
    from public.whatsapp_messages m
    where m.conversation_id = any(p_ids)
    order by m.conversation_id, coalesce(m.message_timestamp, m.created_at) desc
  ),
  legible as (
    select distinct on (m.conversation_id)
      m.conversation_id as cid,
      btrim(m.content) as contenido
    from public.whatsapp_messages m
    where m.conversation_id = any(p_ids)
      and m.content is not null
      and btrim(m.content) <> ''
      and m.content <> '[unknown]'
    order by m.conversation_id, coalesce(m.message_timestamp, m.created_at) desc
  )
  select
    u.conversation_id,
    coalesce(
      l.contenido,
      case when u.message_type is not null and u.message_type <> 'text'
           then '[' || u.message_type || ']' end
    ) as contenido,
    u.message_type as tipo,
    u.creado,
    (
      select nullif(trim(x.sender_name), '')
      from public.whatsapp_messages x
      where x.conversation_id = u.conversation_id
        and x.direction = 'inbound'
        and x.sender_name is not null
        and length(trim(x.sender_name)) > 1
      order by coalesce(x.message_timestamp, x.created_at) desc
      limit 1
    ) as nombre_sugerido
  from ultimo u
  left join legible l on l.cid = u.conversation_id;
$$;

-- ── Recalcular la caché con la misma regla ───────────────────────────────────
with ultimo as (
  select distinct on (m.conversation_id)
    m.conversation_id, coalesce(m.message_timestamp, m.created_at) as creado
  from public.whatsapp_messages m
  order by m.conversation_id, coalesce(m.message_timestamp, m.created_at) desc
),
legible as (
  select distinct on (m.conversation_id)
    m.conversation_id as cid, btrim(m.content) as contenido
  from public.whatsapp_messages m
  where m.content is not null and btrim(m.content) <> '' and m.content <> '[unknown]'
  order by m.conversation_id, coalesce(m.message_timestamp, m.created_at) desc
),
tipo as (
  select distinct on (m.conversation_id)
    m.conversation_id as cid,
    case when coalesce(m.message_type, 'text') <> 'text'
         then '[' || m.message_type || ']' end as marca
  from public.whatsapp_messages m
  order by m.conversation_id, coalesce(m.message_timestamp, m.created_at) desc
)
update public.whatsapp_conversations c
   set last_message_at = u.creado,
       last_message_text = coalesce(l.contenido, t.marca)
  from ultimo u
  left join legible l on l.cid = u.conversation_id
  left join tipo t on t.cid = u.conversation_id
 where u.conversation_id = c.id;

-- ── Chats sin un solo mensaje: al final, no en el tope ───────────────────────
update public.whatsapp_conversations c
   set last_message_at = null
 where c.last_message_at is not null
   and not exists (select 1 from public.whatsapp_messages m where m.conversation_id = c.id);

commit;