-- WhatsApp personal: nombres reales y pendientes reales.
--
-- 1) whatsapp_contacts.display_name nunca se llenaba (el servidor solo escribe
--    saved_name / notify_name / push_name), así que no servía para pintar la
--    bandeja. Un trigger calcula el mejor nombre disponible y, de paso, lo
--    propaga a la conversación cuando la fila todavía tiene el lid o el número
--    como nombre. Así cualquier escritor (el servidor actual o el que venga)
--    deja nombres útiles sin tocar la app.
--
-- 2) whatsapp_conversations.unread_count vale 0 en todas las filas: el contador
--    dependía de un RPC que el servidor llamaba mal. Ahora lo mantiene un
--    trigger sobre los mensajes: entra uno del contacto -> +1; sale uno nuestro
--    -> 0. Y se recalcula lo atrasado como "mensajes entrantes desde la última
--    respuesta nuestra", que es lo que de verdad está pendiente.
--
-- 3) Se guarda el teléfono real (PN) cuando WhatsApp lo manda junto al lid
--    (`remoteJidAlt`), para poder enseñar un número marcable en vez del lid.

begin;

-- ── Columnas para el teléfono real ───────────────────────────────────────────
alter table public.whatsapp_contacts
  add column if not exists pn text;

alter table public.whatsapp_conversations
  add column if not exists remote_pn text;

-- ── Nombre: de contactos a conversaciones ────────────────────────────────────
create or replace function public.wa_nombre_legible(
  p_saved text, p_verified text, p_display text, p_notify text, p_push text
) returns text
language sql
immutable
as $$
  -- Se prefiere el nombre que el dueño del teléfono guardó o verificó.
  select btrim(nullif(coalesce(
    nullif(btrim(coalesce(p_saved, '')), ''),
    nullif(btrim(coalesce(p_verified, '')), ''),
    nullif(btrim(coalesce(p_display, '')), ''),
    nullif(btrim(coalesce(p_notify, '')), ''),
    nullif(btrim(coalesce(p_push, '')), '')
  ), ''));
$$;

create or replace function public.wa_contacto_a_conversacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  v_nombre := public.wa_nombre_legible(
    new.saved_name, new.verified_name, new.display_name, new.notify_name, new.push_name
  );

  -- Un nombre que en realidad es un JID o un número (lid) no es un nombre.
  if v_nombre is not null and (
       v_nombre ~ '@'
       or (v_nombre ~ '^[0-9+\s()-]+$' and length(regexp_replace(v_nombre, '[^0-9]', '', 'g')) >= 14)
     ) then
    v_nombre := null;
  end if;

  if v_nombre is null then
    return new;
  end if;

  update public.whatsapp_contacts
     set display_name = v_nombre
   where id = new.id
     and (display_name is null or display_name = '' or display_name <> v_nombre);

  -- Sólo se pisa un nombre ausente, el propio número o un lid; nunca uno bueno.
  update public.whatsapp_conversations c
     set remote_name = v_nombre,
         remote_pn = coalesce(nullif(c.remote_pn, ''), nullif(new.pn, ''))
   where c.user_id = new.user_id
     and c.remote_phone = new.phone
     and (
       c.remote_name is null
       or btrim(c.remote_name) = ''
       or c.remote_name = c.remote_phone
       or c.remote_name ~ '@'
       or (c.remote_name ~ '^[0-9+\s()-]+$' and length(regexp_replace(c.remote_name, '[^0-9]', '', 'g')) >= 14)
     );

  return new;
end;
$$;

drop trigger if exists trg_wa_contacto_a_conversacion on public.whatsapp_contacts;
create trigger trg_wa_contacto_a_conversacion
after insert or update of saved_name, verified_name, display_name, notify_name, push_name, pn
on public.whatsapp_contacts
for each row execute function public.wa_contacto_a_conversacion();

-- ── Pendientes: el contador sale de los mensajes ─────────────────────────────
create or replace function public.wa_contar_mensaje()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.conversation_id is null then
    return new;
  end if;

  if new.direction = 'inbound' then
    update public.whatsapp_conversations
       set unread_count = coalesce(unread_count, 0) + 1
     where id = new.conversation_id;
  elsif coalesce(new.is_internal_note, false) = false then
    -- Contestamos: ya no hay nada pendiente en ese chat.
    update public.whatsapp_conversations
       set unread_count = 0
     where id = new.conversation_id
       and coalesce(unread_count, 0) <> 0;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_wa_contar_mensaje on public.whatsapp_messages;
create trigger trg_wa_contar_mensaje
after insert on public.whatsapp_messages
for each row execute function public.wa_contar_mensaje();

-- ── Recalculo hacia atrás ────────────────────────────────────────────────────
-- Pendiente = entrantes de los últimos 14 días posteriores a la última
-- respuesta nuestra. Sin ventana, un grupo que lleva un año sin contestar
-- aparecía con 1.500 pendientes y la pestaña dejaba de ser útil.
with ultima_salida as (
  select conversation_id, max(coalesce(message_timestamp, created_at)) as ts
    from public.whatsapp_messages
   where direction = 'outbound'
     and coalesce(is_internal_note, false) = false
   group by conversation_id
),
pendientes as (
  select m.conversation_id, count(*) as n
    from public.whatsapp_messages m
    left join ultima_salida u on u.conversation_id = m.conversation_id
   where m.direction = 'inbound'
     and coalesce(m.message_timestamp, m.created_at) > now() - interval '14 days'
     and (u.ts is null or coalesce(m.message_timestamp, m.created_at) > u.ts)
   group by m.conversation_id
)
update public.whatsapp_conversations c
   set unread_count = coalesce(p.n, 0)
  from pendientes p
 where p.conversation_id = c.id
   and coalesce(c.unread_count, 0) is distinct from coalesce(p.n, 0);

-- Las conversaciones sin entrantes pendientes quedan en cero limpio.
update public.whatsapp_conversations c
   set unread_count = 0
 where coalesce(c.unread_count, 0) <> 0
   and not exists (
     select 1
       from public.whatsapp_messages m
      where m.conversation_id = c.id
        and m.direction = 'inbound'
        and coalesce(m.message_timestamp, m.created_at) > now() - interval '14 days'
   );

-- ── Teléfono real ya conocido: no perderlo ───────────────────────────────────
update public.whatsapp_conversations c
   set remote_pn = k.pn
  from public.whatsapp_contacts k
 where k.user_id = c.user_id
   and k.phone = c.remote_phone
   and coalesce(k.pn, '') <> ''
   and coalesce(c.remote_pn, '') = '';

commit;