/*
  # Fix Assistant Tables RLS - Clean Policies

  1. Changes
    - Clean up conversaciones_chatgpt policies
    - Clean up oficinas policies
    - Ensure service_role has direct access with proper role assignment
    - Remove duplicate and conflicting policies

  2. Security
    - Service role has unrestricted access (for edge functions)
    - Authenticated users can only access their own data
    - Proper separation of concerns
*/

-- ============================================
-- CONVERSACIONES_CHATGPT
-- ============================================

-- Drop all existing policies
drop policy if exists "Conversaciones: delete own" on conversaciones_chatgpt;
drop policy if exists "Conversaciones: insert own" on conversaciones_chatgpt;
drop policy if exists "Conversaciones: select own" on conversaciones_chatgpt;
drop policy if exists "Conversaciones: update own" on conversaciones_chatgpt;
drop policy if exists "Service role can view all conversations" on conversaciones_chatgpt;
drop policy if exists "Service role full access conversaciones" on conversaciones_chatgpt;
drop policy if exists "Users can create own conversations" on conversaciones_chatgpt;
drop policy if exists "Users can delete own conversations" on conversaciones_chatgpt;
drop policy if exists "Users can update own conversations" on conversaciones_chatgpt;
drop policy if exists "Users can view own conversations" on conversaciones_chatgpt;

-- Create clean policies for conversaciones_chatgpt

-- Service role: full access
create policy "Service role: full access conversations"
on conversaciones_chatgpt
for all
to service_role
using (true)
with check (true);

-- Authenticated: view own conversations
create policy "Authenticated: view own conversations"
on conversaciones_chatgpt
for select
to authenticated
using (usuario_id = auth.uid());

-- Authenticated: create own conversations
create policy "Authenticated: create own conversations"
on conversaciones_chatgpt
for insert
to authenticated
with check (usuario_id = auth.uid());

-- Authenticated: update own conversations
create policy "Authenticated: update own conversations"
on conversaciones_chatgpt
for update
to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

-- Authenticated: delete own conversations
create policy "Authenticated: delete own conversations"
on conversaciones_chatgpt
for delete
to authenticated
using (usuario_id = auth.uid());

-- ============================================
-- OFICINAS
-- ============================================

-- Drop conflicting policies
drop policy if exists "Service role can read all oficinas" on oficinas;
drop policy if exists "Oficinas: authenticated can read" on oficinas;

-- Keep existing good policies and add service role
create policy "Service role: read all oficinas"
on oficinas
for select
to service_role
using (true);