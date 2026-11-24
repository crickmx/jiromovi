/*
  # Fix Mensajes ChatGPT RLS for Service Role

  1. Changes
    - Add service role policies for full access
    - Keep existing user policies
    - Ensure messages can be inserted by edge functions

  2. Security
    - Service role has full access (for edge functions saving messages)
    - Users can only see messages from their own conversations
*/

-- Drop existing service role policies if any
drop policy if exists "Service role: full access messages" on mensajes_chatgpt;

-- Add service role policy for full access
create policy "Service role: full access messages"
on mensajes_chatgpt
for all
to service_role
using (true)
with check (true);