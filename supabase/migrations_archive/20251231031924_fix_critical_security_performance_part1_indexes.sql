/*
  # Fix Critical Security and Performance - Part 1: Missing Indexes

  ## Problema
  Claves foráneas sin índices causan rendimiento subóptimo en queries con JOINs

  ## Cambios
  Agregar índices faltantes a claves foráneas en tablas de alto tráfico

  ## Seguridad
  - Solo agrega índices, no cambia permisos
*/

-- Assistant tables (alto tráfico)
CREATE INDEX IF NOT EXISTS idx_assistant_action_clicks_action_id 
  ON assistant_action_clicks(action_id);

CREATE INDEX IF NOT EXISTS idx_assistant_actions_intent_codigo 
  ON assistant_actions(intent_codigo);

CREATE INDEX IF NOT EXISTS idx_assistant_suggestions_intent_codigo 
  ON assistant_suggestions(intent_codigo);

CREATE INDEX IF NOT EXISTS idx_conversaciones_chatgpt_snapshot_id 
  ON conversaciones_chatgpt(snapshot_id);

-- Meeting tables (nombre correcto de columna)
CREATE INDEX IF NOT EXISTS idx_meeting_chat_messages_meeting_id 
  ON meeting_chat_messages(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_chat_messages_remitente_id 
  ON meeting_chat_messages(remitente_id);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id 
  ON meeting_participants(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id_fk 
  ON meeting_participants(user_id);

-- SICAS mapping (consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_vendedor_movi_user_id 
  ON sicas_mapeo_vendedor_usuario(movi_user_id);

-- Log
DO $$
BEGIN
  RAISE NOTICE '✅ Part 1: 9 índices agregados a claves foráneas';
END $$;
