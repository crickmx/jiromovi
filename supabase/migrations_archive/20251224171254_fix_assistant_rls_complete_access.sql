/*
  # Fix Assistant RLS - Complete Service Role Access

  1. Changes
    - Drop ALL conflicting policies on mensajes_chatgpt
    - Create clean, minimal policies for authenticated users
    - Ensure service_role has unrestricted access to all assistant tables
    
  2. Security
    - Authenticated users can only access their own conversations/messages
    - service_role bypasses ALL RLS (used by edge functions)
*/

-- Drop ALL existing policies on mensajes_chatgpt to start clean
DROP POLICY IF EXISTS "Mensajes: insert own" ON mensajes_chatgpt;
DROP POLICY IF EXISTS "Mensajes: select own" ON mensajes_chatgpt;
DROP POLICY IF EXISTS "Service role full access mensajes" ON mensajes_chatgpt;
DROP POLICY IF EXISTS "Service role: full access messages" ON mensajes_chatgpt;
DROP POLICY IF EXISTS "Service role can view all messages" ON mensajes_chatgpt;
DROP POLICY IF EXISTS "Edge functions can insert messages" ON mensajes_chatgpt;
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON mensajes_chatgpt;
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON mensajes_chatgpt;

-- Create single service_role policy for mensajes_chatgpt
CREATE POLICY "service_role_all_access_messages"
  ON mensajes_chatgpt
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create authenticated user policy for mensajes_chatgpt
CREATE POLICY "authenticated_view_own_messages"
  ON mensajes_chatgpt
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversaciones_chatgpt
      WHERE conversaciones_chatgpt.id = mensajes_chatgpt.conversacion_id
      AND conversaciones_chatgpt.usuario_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_insert_own_messages"
  ON mensajes_chatgpt
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversaciones_chatgpt
      WHERE conversaciones_chatgpt.id = mensajes_chatgpt.conversacion_id
      AND conversaciones_chatgpt.usuario_id = auth.uid()
    )
  );

-- Ensure oficinas has service_role access
DROP POLICY IF EXISTS "Service role: read all oficinas" ON oficinas;

CREATE POLICY "service_role_all_access_oficinas"
  ON oficinas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
