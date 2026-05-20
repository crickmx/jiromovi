/*
  # Fix Duplicate Assistants — Cascade Delete Auto Generated (v2)

  ## Summary
  Deletes all auto_generated assistants along with all related records.
  These are broken (req_count=0) and duplicated by properly configured system_seed assistants.

  ## Tables cleaned (in FK-safe order)
  1. contact_center_assistant_sessions (sessions reference assistants)
  2. contact_center_assistant_session_data (references sessions)
  3. contact_center_assistant_events (references sessions)
  4. contact_center_assistant_templates
  5. contact_center_assistant_metrics
  6. contact_center_assistant_sync_logs
  7. contact_center_conversation_modes (nullify assigned_assistant_id)
  8. contact_center_assistant_fields
  9. contact_center_assistants (finally delete)
*/

-- Collect auto_generated IDs
DO $$
DECLARE
  auto_ids uuid[];
  session_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO auto_ids
  FROM contact_center_assistants
  WHERE generation_origin = 'auto_generated';

  IF auto_ids IS NULL OR array_length(auto_ids, 1) = 0 THEN
    RAISE NOTICE 'No auto_generated assistants found. Nothing to delete.';
    RETURN;
  END IF;

  -- Get session IDs for these assistants
  SELECT array_agg(id) INTO session_ids
  FROM contact_center_assistant_sessions
  WHERE assistant_id = ANY(auto_ids);

  -- Delete session_data
  IF session_ids IS NOT NULL THEN
    DELETE FROM contact_center_assistant_session_data
    WHERE session_id = ANY(session_ids);

    DELETE FROM contact_center_assistant_events
    WHERE session_id = ANY(session_ids);
  END IF;

  -- Delete sessions
  DELETE FROM contact_center_assistant_sessions
  WHERE assistant_id = ANY(auto_ids);

  -- Delete templates
  DELETE FROM contact_center_assistant_templates
  WHERE assistant_id = ANY(auto_ids);

  -- Delete metrics
  DELETE FROM contact_center_assistant_metrics
  WHERE assistant_id = ANY(auto_ids);

  -- Delete sync logs
  DELETE FROM contact_center_assistant_sync_logs
  WHERE assistant_id = ANY(auto_ids);

  -- Nullify conversation modes references
  UPDATE contact_center_conversation_modes
  SET assigned_assistant_id = NULL
  WHERE assigned_assistant_id = ANY(auto_ids);

  -- Delete fields
  DELETE FROM contact_center_assistant_fields
  WHERE assistant_id = ANY(auto_ids);

  -- Finally delete the assistants
  DELETE FROM contact_center_assistants
  WHERE id = ANY(auto_ids);

  RAISE NOTICE 'Deleted % auto_generated assistants', array_length(auto_ids, 1);
END $$;
