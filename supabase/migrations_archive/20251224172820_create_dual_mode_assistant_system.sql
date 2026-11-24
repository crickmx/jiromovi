/*
  # Create Dual-Mode Assistant System (1 Chat, 2 Cerebros)
  
  1. New Tables
    - `assistant_routing_logs`
      - Logs all routing decisions with scoring details
      - Tracks mode selection (chatgpt vs movi)
      - Stores confidence scores and reasoning
    
    - `assistant_mode_analytics`
      - Aggregated analytics per user and mode
      - Success rates, response times, user feedback
      - Used for continuous improvement
  
  2. Changes to Existing Tables
    - Add `modo_usado` to `mensajes_chatgpt` (chatgpt or movi)
    - Add `router_confidence` to track routing confidence
    - Add `web_sources` JSONB for web search results
  
  3. Indexes
    - Performance indexes for analytics queries
    - Indexes on conversation_id and modo_usado
  
  4. Security
    - Enable RLS on all new tables
    - Users can only access their own routing logs
    - Admins can access all analytics
*/

-- Add new columns to mensajes_chatgpt for mode tracking
ALTER TABLE mensajes_chatgpt 
ADD COLUMN IF NOT EXISTS modo_usado text CHECK (modo_usado IN ('chatgpt', 'movi'));

ALTER TABLE mensajes_chatgpt 
ADD COLUMN IF NOT EXISTS router_confidence numeric(5,2);

ALTER TABLE mensajes_chatgpt 
ADD COLUMN IF NOT EXISTS web_sources jsonb DEFAULT '[]'::jsonb;

-- Create assistant_routing_logs table
CREATE TABLE IF NOT EXISTS assistant_routing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversaciones_chatgpt(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_message text NOT NULL,
  selected_mode text NOT NULL CHECK (selected_mode IN ('chatgpt', 'movi')),
  
  -- Scoring details
  chatgpt_score numeric(5,2) NOT NULL,
  movi_score numeric(5,2) NOT NULL,
  confidence_score numeric(5,2) NOT NULL,
  
  -- Router reasoning
  router_reasoning jsonb NOT NULL,
  matched_keywords text[],
  
  -- Performance tracking
  response_time_ms integer,
  user_feedback text CHECK (user_feedback IN ('positive', 'negative', 'neutral')),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_scores CHECK (
    chatgpt_score >= 0 AND chatgpt_score <= 100 AND
    movi_score >= 0 AND movi_score <= 100 AND
    confidence_score >= 0 AND confidence_score <= 100
  )
);

-- Create assistant_mode_analytics table for aggregated metrics
CREATE TABLE IF NOT EXISTS assistant_mode_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('chatgpt', 'movi')),
  
  -- Metrics
  total_queries integer DEFAULT 0,
  successful_queries integer DEFAULT 0,
  average_response_time_ms numeric(10,2),
  positive_feedback integer DEFAULT 0,
  negative_feedback integer DEFAULT 0,
  
  -- Time period
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  
  -- Auto-update timestamp
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, mode, period_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_routing_logs_conversation 
ON assistant_routing_logs(conversation_id);

CREATE INDEX IF NOT EXISTS idx_routing_logs_user 
ON assistant_routing_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_routing_logs_mode 
ON assistant_routing_logs(selected_mode);

CREATE INDEX IF NOT EXISTS idx_routing_logs_created 
ON assistant_routing_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mode_analytics_user 
ON assistant_mode_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_mode_analytics_period 
ON assistant_mode_analytics(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_mensajes_modo 
ON mensajes_chatgpt(modo_usado) WHERE modo_usado IS NOT NULL;

-- Enable RLS
ALTER TABLE assistant_routing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_mode_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assistant_routing_logs
CREATE POLICY "Users can view own routing logs"
  ON assistant_routing_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert routing logs"
  ON assistant_routing_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can view all routing logs"
  ON assistant_routing_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND usuarios.rol = 'admin'
    )
  );

-- RLS Policies for assistant_mode_analytics
CREATE POLICY "Users can view own analytics"
  ON assistant_mode_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage analytics"
  ON assistant_mode_analytics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all analytics"
  ON assistant_mode_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
      AND usuarios.rol = 'admin'
    )
  );

-- Function to update analytics after routing
CREATE OR REPLACE FUNCTION update_assistant_analytics()
RETURNS trigger AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  -- Calculate weekly period
  v_period_start := date_trunc('week', NEW.created_at);
  v_period_end := v_period_start + interval '7 days';
  
  -- Upsert analytics record
  INSERT INTO assistant_mode_analytics (
    user_id,
    mode,
    total_queries,
    period_start,
    period_end,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.selected_mode,
    1,
    v_period_start,
    v_period_end,
    now()
  )
  ON CONFLICT (user_id, mode, period_start)
  DO UPDATE SET
    total_queries = assistant_mode_analytics.total_queries + 1,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update analytics
DROP TRIGGER IF EXISTS update_analytics_on_routing ON assistant_routing_logs;
CREATE TRIGGER update_analytics_on_routing
  AFTER INSERT ON assistant_routing_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_assistant_analytics();

-- Function to record user feedback
CREATE OR REPLACE FUNCTION record_assistant_feedback(
  p_routing_log_id uuid,
  p_feedback text,
  p_response_time_ms integer DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_log record;
BEGIN
  -- Update routing log with feedback
  UPDATE assistant_routing_logs
  SET 
    user_feedback = p_feedback,
    response_time_ms = COALESCE(p_response_time_ms, response_time_ms)
  WHERE id = p_routing_log_id
  RETURNING * INTO v_log;
  
  -- Update analytics
  IF p_feedback = 'positive' THEN
    UPDATE assistant_mode_analytics
    SET 
      successful_queries = successful_queries + 1,
      positive_feedback = positive_feedback + 1,
      updated_at = now()
    WHERE user_id = v_log.user_id 
      AND mode = v_log.selected_mode
      AND period_start = date_trunc('week', v_log.created_at);
  ELSIF p_feedback = 'negative' THEN
    UPDATE assistant_mode_analytics
    SET 
      negative_feedback = negative_feedback + 1,
      updated_at = now()
    WHERE user_id = v_log.user_id 
      AND mode = v_log.selected_mode
      AND period_start = date_trunc('week', v_log.created_at);
  END IF;
  
  -- Update average response time if provided
  IF p_response_time_ms IS NOT NULL THEN
    UPDATE assistant_mode_analytics
    SET 
      average_response_time_ms = (
        COALESCE(average_response_time_ms, 0) * (total_queries - 1) + p_response_time_ms
      ) / total_queries,
      updated_at = now()
    WHERE user_id = v_log.user_id 
      AND mode = v_log.selected_mode
      AND period_start = date_trunc('week', v_log.created_at);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;