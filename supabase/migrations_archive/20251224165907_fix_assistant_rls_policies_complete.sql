/*
  # Fix Assistant RLS Policies - Complete

  1. Changes
    - Ensure RLS is enabled on all assistant tables
    - Add comprehensive RLS policies for:
      - conversaciones_chatgpt (threads)
      - mensajes_chatgpt (messages)
      - assistant_events
      - assistant_action_clicks
    - Add policies for usuarios and oficinas (read-only for authenticated)

  2. Security
    - Users can only access their own conversations and messages
    - Users can read basic information from usuarios and oficinas
    - Service role can bypass all restrictions for internal operations
*/

-- Enable RLS on assistant tables
alter table conversaciones_chatgpt enable row level security;
alter table mensajes_chatgpt enable row level security;
alter table assistant_events enable row level security;
alter table assistant_action_clicks enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Conversaciones: select own" on conversaciones_chatgpt;
drop policy if exists "Conversaciones: insert own" on conversaciones_chatgpt;
drop policy if exists "Conversaciones: update own" on conversaciones_chatgpt;
drop policy if exists "Conversaciones: delete own" on conversaciones_chatgpt;

drop policy if exists "Mensajes: select own" on mensajes_chatgpt;
drop policy if exists "Mensajes: insert own" on mensajes_chatgpt;

drop policy if exists "Events: select own" on assistant_events;
drop policy if exists "Events: insert own" on assistant_events;
drop policy if exists "Events: update own" on assistant_events;

drop policy if exists "Action Clicks: insert own" on assistant_action_clicks;

-- Conversaciones policies
create policy "Conversaciones: select own"
on conversaciones_chatgpt
for select
using (usuario_id = auth.uid());

create policy "Conversaciones: insert own"
on conversaciones_chatgpt
for insert
with check (usuario_id = auth.uid());

create policy "Conversaciones: update own"
on conversaciones_chatgpt
for update
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

create policy "Conversaciones: delete own"
on conversaciones_chatgpt
for delete
using (usuario_id = auth.uid());

-- Mensajes policies
create policy "Mensajes: select own"
on mensajes_chatgpt
for select
using (
  exists (
    select 1 from conversaciones_chatgpt
    where conversaciones_chatgpt.id = mensajes_chatgpt.conversacion_id
    and conversaciones_chatgpt.usuario_id = auth.uid()
  )
);

create policy "Mensajes: insert own"
on mensajes_chatgpt
for insert
with check (
  exists (
    select 1 from conversaciones_chatgpt
    where conversaciones_chatgpt.id = mensajes_chatgpt.conversacion_id
    and conversaciones_chatgpt.usuario_id = auth.uid()
  )
);

-- Assistant events policies
create policy "Events: select own"
on assistant_events
for select
using (usuario_id = auth.uid());

create policy "Events: insert own"
on assistant_events
for insert
with check (usuario_id = auth.uid());

create policy "Events: update own"
on assistant_events
for update
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

-- Action clicks policies
create policy "Action Clicks: insert own"
on assistant_action_clicks
for insert
with check (usuario_id = auth.uid());

-- Ensure usuarios has a basic read policy for authenticated users
-- This allows edge functions to read user profiles
drop policy if exists "Usuarios: authenticated can read basic info" on usuarios;

create policy "Usuarios: authenticated can read basic info"
on usuarios
for select
using (auth.role() = 'authenticated');

-- Ensure oficinas has a basic read policy for authenticated users
drop policy if exists "Oficinas: authenticated can read" on oficinas;

create policy "Oficinas: authenticated can read"
on oficinas
for select
using (auth.role() = 'authenticated');