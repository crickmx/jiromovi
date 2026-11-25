-- El último mensaje de cada chat de WhatsApp personal se denormaliza en
-- whatsapp_conversations.last_message_text / last_message_at, pero el importador
-- de historial del servidor de WhatsApp no los escribe: la columna quedó vacía
-- en casi todas las filas y la bandeja del Centro de Contacto decía "Sin
-- mensajes" aunque el chat tuviera cientos. Aquí se rellena desde los mensajes
-- reales, que son la verdad.
--
-- También recupera el nombre desde whatsapp_contacts cuando la fila solo tiene
-- el número (o el lid) como nombre.
--
-- Idempotente: se puede volver a correr sin efecto si ya está al día.

begin;

-- 1) Último mensaje real de cada conversación.
update whatsapp_conversations c
set last_message_text = left(nullif(u.contenido, '[unknown]'), 200),
    last_message_at   = u.ts
from (
  select conversation_id,
         content as contenido,
         coalesce(message_timestamp, created_at) as ts,
         row_number() over (
           partition by conversation_id
           order by coalesce(message_timestamp, created_at) desc
         ) as rn
  from whatsapp_messages
) u
where u.rn = 1
  and u.conversation_id = c.id
  and (
    coalesce(c.last_message_text, '') is distinct from coalesce(nullif(u.contenido, '[unknown]'), '')
    or c.last_message_at is distinct from u.ts
  );

-- 2) Cuando el mensaje más reciente no trae texto (audio, imagen, un mensaje
--    que el servidor no supo parsear), la vista previa muestra el tipo en vez
--    de quedarse muda.
update whatsapp_conversations c
set last_message_text = left(u.contenido, 200)
from (
  select conversation_id,
         content as contenido,
         row_number() over (
           partition by conversation_id
           order by coalesce(message_timestamp, created_at) desc
         ) as rn
  from whatsapp_messages
  where content is not null and btrim(content) <> '' and content <> '[unknown]'
) u
where u.rn = 1
  and u.conversation_id = c.id
  and (
    c.last_message_text is null
    or c.last_message_text = ''
    or c.last_message_text = '[unknown]'
  );

update whatsapp_conversations c
set last_message_text = '[' || u.tipo || ']'
from (
  select conversation_id,
         coalesce(nullif(message_type, ''), 'mensaje') as tipo,
         row_number() over (
           partition by conversation_id
           order by coalesce(message_timestamp, created_at) desc
         ) as rn
  from whatsapp_messages
  where coalesce(message_type, 'text') not in ('text', '')
) u
where u.rn = 1
  and u.conversation_id = c.id
  and (
    c.last_message_text is null
    or c.last_message_text = ''
    or c.last_message_text = '[unknown]'
  );

-- 3) Nombre desde la tabla de contactos, sólo si la fila no tiene uno legible.
update whatsapp_conversations c
set remote_name = k.display_name
from whatsapp_contacts k
where k.user_id = c.user_id
  and k.jid = c.remote_phone || '@lid'
  and coalesce(k.display_name, '') <> ''
  and (
    c.remote_name is null
    or c.remote_name = ''
    or c.remote_name = c.remote_phone
  );

commit;