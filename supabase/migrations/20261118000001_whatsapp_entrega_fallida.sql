-- WhatsApp: marcar como fallidos los envíos que Wazzup aceptó pero WhatsApp rechazó.
--
-- Wazzup responde 201 al enviar y la app guardaba "enviado". El rechazo real
-- (UNKNOWN_ERROR, BAD_CONTACT, TEMPLATE_REJECTED…) llega después por el webhook.
-- Ahora cada envío guarda el messageId en provider_message_id y wazzup-webhook
-- marca la fila como fallida. Esta migración:
--   1. indexa provider_message_id (el webhook busca por ahí en cada evento);
--   2. corrige el historial de los últimos 30 días, emparejando por número y hora
--      contra los errores que ya quedaron en wazzup_webhook_logs.

create index if not exists idx_correo_historial_envios_provider_message_id
  on correo_historial_envios (provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_contact_center_messages_provider_message_id
  on contact_center_messages (provider_message_id)
  where provider_message_id is not null;

-- Backfill: los envíos viejos no guardaron messageId, así que se emparejan por
-- los últimos 10 dígitos del número y una ventana de -5 s / +2 min.
with errores as (
  select (x->>'dateTime')::timestamptz as t,
         right(x->>'chatId', 10)       as tel10,
         x->>'messageId'               as message_id,
         coalesce(x->'error'->>'error', '') ||
           case when x->'error'->>'description' is not null
                then ': ' || (x->'error'->>'description') else '' end as detalle
  from wazzup_webhook_logs l,
       jsonb_array_elements(l.payload->'messages') x
  where l.received_at > now() - interval '30 days'
    and x->>'status' = 'error'
),
pares as (
  select distinct on (h.id) h.id, e.message_id, e.detalle
  from correo_historial_envios h
  join errores e
    on right(regexp_replace(coalesce(h.numero_destino, ''), '\D', '', 'g'), 10) = e.tel10
   and e.t between coalesce(h.fecha_envio, h.created_at) - interval '5 seconds'
               and coalesce(h.fecha_envio, h.created_at) + interval '2 minutes'
  where h.canal_envio = 'whatsapp'
    and h.estado = 'enviado'
    and h.created_at > now() - interval '30 days'
  order by h.id, abs(extract(epoch from (e.t - coalesce(h.fecha_envio, h.created_at))))
)
update correo_historial_envios h
set estado = 'fallido',
    error_mensaje = 'Wazzup: ' || nullif(p.detalle, ''),
    provider_message_id = coalesce(h.provider_message_id, p.message_id)
from pares p
where h.id = p.id;

-- Centro de contacto: los ecos con error se guardaron como "sent".
update contact_center_messages m
set status = 'failed',
    error_message = 'Wazzup: ' || coalesce(m.provider_response->'error'->>'error', '') ||
      coalesce(': ' || (m.provider_response->'error'->>'description'), ''),
    updated_at = now()
where m.provider = 'wazzup'
  and m.direction = 'outbound'
  and m.status = 'sent'
  and m.provider_response->>'status' = 'error';
