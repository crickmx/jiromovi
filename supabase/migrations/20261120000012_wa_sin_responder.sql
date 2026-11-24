-- ============================================================================
-- WhatsApp personal: conversaciones que esperan respuesta
--
-- `whatsapp_conversations.unread_count` no se está llenando (queda en 0),
-- así que el dashboard mostraba "sin mensajes pendientes" aunque hubiera
-- conversaciones esperando. El criterio real y comprobable es: el último
-- mensaje de la conversación es entrante (lo escribió el cliente y nadie ha
-- contestado todavía).
-- ============================================================================

create or replace function public.wa_sin_responder(
  p_user_id uuid,
  p_dias integer default 14,
  p_limite integer default 4
)
returns table (
  conversation_id uuid,
  nombre text,
  group_name text,
  telefono text,
  ultimo text,
  cuando timestamptz
)
language sql
stable
as $$
  with ultimos as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.direction,
      m.content,
      m.message_type,
      coalesce(m.message_timestamp, m.created_at) as cuando
    from public.whatsapp_messages m
    join public.whatsapp_conversations c on c.id = m.conversation_id
    where c.user_id = p_user_id
      and coalesce(m.message_timestamp, m.created_at) > now() - (p_dias || ' days')::interval
    order by m.conversation_id, coalesce(m.message_timestamp, m.created_at) desc
  )
  select
    c.id,
    case
      when c.remote_name is not null and c.remote_name <> '' and c.remote_name <> c.remote_phone
        then c.remote_name
      else null
    end as nombre,
    c.group_name,
    c.remote_phone,
    case when u.message_type = 'text' then u.content else '[' || coalesce(u.message_type, 'mensaje') || ']' end,
    u.cuando
  from ultimos u
  join public.whatsapp_conversations c on c.id = u.conversation_id
  where u.direction = 'inbound'
    and coalesce(c.is_archived, false) = false
  order by u.cuando desc
  limit p_limite;
$$;

grant execute on function public.wa_sin_responder(uuid, integer, integer) to authenticated, service_role;