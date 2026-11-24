-- ============================================================================
-- WhatsApp personal: último mensaje y nombre real de cada conversación
--
-- Las conversaciones que llegan por el protocolo nuevo de WhatsApp traen un
-- "lid" (un número largo) en vez del teléfono, y a veces sin nombre. La lista
-- quedaba con números crudos y sin vista previa aunque hubiera mensajes.
-- ============================================================================

-- Índice para sacar el último mensaje de cada conversación sin recorrer todo.
create index if not exists whatsapp_messages_conv_fecha_idx
  on public.whatsapp_messages (conversation_id, created_at desc);

create or replace function public.wa_ultimos_mensajes(p_ids uuid[])
returns table (
  conversation_id uuid,
  contenido text,
  tipo text,
  creado timestamptz,
  nombre_sugerido text
)
language sql
stable
as $$
  select distinct on (m.conversation_id)
    m.conversation_id,
    m.content,
    m.message_type,
    coalesce(m.message_timestamp, m.created_at) as creado,
    (
      select nullif(trim(x.sender_name), '')
      from public.whatsapp_messages x
      where x.conversation_id = m.conversation_id
        and x.direction = 'inbound'
        and x.sender_name is not null
        and length(trim(x.sender_name)) > 1
      order by coalesce(x.message_timestamp, x.created_at) desc
      limit 1
    ) as nombre_sugerido
  from public.whatsapp_messages m
  where m.conversation_id = any(p_ids)
  order by m.conversation_id, coalesce(m.message_timestamp, m.created_at) desc;
$$;

grant execute on function public.wa_ultimos_mensajes(uuid[]) to authenticated, service_role;