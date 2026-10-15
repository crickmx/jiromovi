/*
  # Create ChatGPT Integration System

  1. New Tables
    - `conversaciones_chatgpt`
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, references usuarios)
      - `titulo` (text, conversation title)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `mensajes_chatgpt`
      - `id` (uuid, primary key)
      - `conversacion_id` (uuid, references conversaciones_chatgpt)
      - `rol` (text, user/assistant/system)
      - `contenido` (text, message content)
      - `tokens_usados` (integer, tokens used)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own conversations
    - Users can only access messages from their conversations

  3. Indexes
    - Add index on usuario_id for fast lookups
    - Add index on conversacion_id for message queries
*/

-- Create conversaciones_chatgpt table
CREATE TABLE IF NOT EXISTS conversaciones_chatgpt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT 'Nueva conversación',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create mensajes_chatgpt table
CREATE TABLE IF NOT EXISTS mensajes_chatgpt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES conversaciones_chatgpt(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('user', 'assistant', 'system')),
  contenido text NOT NULL,
  tokens_usados integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE conversaciones_chatgpt ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_chatgpt ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversaciones_chatgpt
CREATE POLICY "Users can view own conversations"
  ON conversaciones_chatgpt
  FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

CREATE POLICY "Users can create own conversations"
  ON conversaciones_chatgpt
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update own conversations"
  ON conversaciones_chatgpt
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can delete own conversations"
  ON conversaciones_chatgpt
  FOR DELETE
  TO authenticated
  USING (auth.uid() = usuario_id);

-- RLS Policies for mensajes_chatgpt
CREATE POLICY "Users can view messages from own conversations"
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

CREATE POLICY "Users can create messages in own conversations"
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

CREATE POLICY "Edge functions can insert messages"
  ON mensajes_chatgpt
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversaciones_usuario
  ON conversaciones_chatgpt(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion
  ON mensajes_chatgpt(conversacion_id, created_at ASC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversacion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversaciones_chatgpt
  SET updated_at = now()
  WHERE id = NEW.conversacion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update conversation timestamp when new message is added
DROP TRIGGER IF EXISTS trigger_update_conversacion_timestamp ON mensajes_chatgpt;
CREATE TRIGGER trigger_update_conversacion_timestamp
  AFTER INSERT ON mensajes_chatgpt
  FOR EACH ROW
  EXECUTE FUNCTION update_conversacion_timestamp();
