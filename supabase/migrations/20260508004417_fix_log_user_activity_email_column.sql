/*
  # Fix log_user_activity function - email column reference

  1. Problem
    - Function references `u.email` which does not exist on `usuarios` table
    - The correct column is `u.email_laboral`
    - This causes RPC errors when logging user activity

  2. Fix
    - Change `u.email` to `u.email_laboral` in the SELECT statement
*/

CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_user_id uuid,
  p_module text,
  p_event_type text,
  p_action text,
  p_summary text,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_status text DEFAULT 'success'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name text;
  v_email text;
  v_office_id uuid;
  v_office_name text;
  v_role text;
  v_log_id uuid;
BEGIN
  -- Get user snapshot data
  SELECT 
    COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos),
    u.email_laboral,
    u.oficina_id,
    u.rol
  INTO v_user_name, v_email, v_office_id, v_role
  FROM usuarios u WHERE u.id = p_user_id;

  -- Get office name
  IF v_office_id IS NOT NULL THEN
    SELECT nombre INTO v_office_name FROM oficinas WHERE id = v_office_id;
  END IF;

  INSERT INTO user_activity_logs (
    user_id, user_name_snapshot, email_snapshot, office_id, office_name_snapshot,
    role_snapshot, module, event_type, action, entity_type, entity_id,
    summary, details, metadata, status
  ) VALUES (
    p_user_id, COALESCE(v_user_name, ''), COALESCE(v_email, ''),
    v_office_id, COALESCE(v_office_name, ''), COALESCE(v_role, ''),
    p_module, p_event_type, p_action, p_entity_type, p_entity_id,
    p_summary, p_details, p_metadata, p_status
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
