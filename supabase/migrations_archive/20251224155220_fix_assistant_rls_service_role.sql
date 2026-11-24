/*
  # Fix Assistant RLS for Service Role

  1. Changes
    - Add service_role policies for conversaciones_chatgpt (read access)
    - Add service_role policies for mensajes_chatgpt (read access)
    - This allows edge functions to read conversations and messages

  2. Security
    - Service role has full access (this is by design for edge functions)
    - Regular users still restricted to their own data
*/

-- Add service_role SELECT policy for conversaciones_chatgpt
CREATE POLICY "Service role can view all conversations"
  ON conversaciones_chatgpt
  FOR SELECT
  TO service_role
  USING (true);

-- Add service_role SELECT policy for mensajes_chatgpt  
CREATE POLICY "Service role can view all messages"
  ON mensajes_chatgpt
  FOR SELECT
  TO service_role
  USING (true);