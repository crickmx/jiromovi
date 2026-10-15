/*
  # Create User Activity Logs System

  1. New Tables
    - `user_activity_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to usuarios)
      - `user_name_snapshot` (text) - cached user name at time of event
      - `email_snapshot` (text) - cached email at time of event
      - `office_id` (uuid) - cached office id
      - `office_name_snapshot` (text) - cached office name
      - `role_snapshot` (text) - cached role at time of event
      - `module` (text) - which module generated the event
      - `event_type` (text) - category: auth, profile, production, publicity, education, crm, tramites, system
      - `action` (text) - specific action performed
      - `entity_type` (text) - related entity type if any
      - `entity_id` (text) - related entity id if any
      - `summary` (text) - human readable summary
      - `details` (jsonb) - additional structured details
      - `metadata` (jsonb) - technical metadata (ip, user_agent, device)
      - `status` (text) - success, error, warning
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Only admins can SELECT
    - Insert via service role or authenticated users (own events only)

  3. Indexes
    - user_id, created_at, module, event_type for fast filtered queries

  4. Notes
    - Designed for high-volume inserts and admin-only reads
    - Snapshots avoid joins for historical accuracy
*/

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name_snapshot text DEFAULT '',
  email_snapshot text DEFAULT '',
  office_id uuid,
  office_name_snapshot text DEFAULT '',
  role_snapshot text DEFAULT '',
  module text NOT NULL DEFAULT 'system',
  event_type text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity_type text,
  entity_id text,
  summary text NOT NULL DEFAULT '',
  details jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy
CREATE POLICY "Admins can read all activity logs"
  ON public.user_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.rol = 'Administrador'
    )
  );

-- Authenticated users can insert their own activity
CREATE POLICY "Users can insert own activity"
  ON public.user_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON public.user_activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON public.user_activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON public.user_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module_type ON public.user_activity_logs(module, event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_office ON public.user_activity_logs(office_id);

-- Helper function to log activity (can be called from triggers or edge functions)
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
    u.email,
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

-- Function to get activity KPIs for admin dashboard
CREATE OR REPLACE FUNCTION public.get_activity_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_caller_role text;
BEGIN
  SELECT rol INTO v_caller_role FROM usuarios WHERE id = auth.uid();
  IF v_caller_role != 'Administrador' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'active_today', (
      SELECT COUNT(DISTINCT user_id) FROM user_activity_logs
      WHERE created_at >= CURRENT_DATE
    ),
    'active_this_week', (
      SELECT COUNT(DISTINCT user_id) FROM user_activity_logs
      WHERE created_at >= date_trunc('week', CURRENT_DATE)
    ),
    'active_this_month', (
      SELECT COUNT(DISTINCT user_id) FROM user_activity_logs
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
    ),
    'total_logins_today', (
      SELECT COUNT(*) FROM user_activity_logs
      WHERE created_at >= CURRENT_DATE AND action = 'login'
    ),
    'total_logins_week', (
      SELECT COUNT(*) FROM user_activity_logs
      WHERE created_at >= date_trunc('week', CURRENT_DATE) AND action = 'login'
    ),
    'inactive_users', (
      SELECT COUNT(*) FROM usuarios u
      WHERE u.activo = true AND u.rol != 'Administrador'
        AND NOT EXISTS (
          SELECT 1 FROM user_activity_logs al
          WHERE al.user_id = u.id AND al.created_at >= CURRENT_DATE - interval '30 days'
        )
    ),
    'profile_changes_month', (
      SELECT COUNT(*) FROM user_activity_logs
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND event_type = 'profile'
    ),
    'publicity_created_month', (
      SELECT COUNT(*) FROM user_activity_logs
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND module = 'publicidad'
    ),
    'courses_started_month', (
      SELECT COUNT(*) FROM user_activity_logs
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND action = 'course_start'
    ),
    'courses_completed_month', (
      SELECT COUNT(*) FROM user_activity_logs
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND action = 'course_complete'
    ),
    'tramites_responded_month', (
      SELECT COUNT(*) FROM user_activity_logs
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND module = 'tramites'
    ),
    'crm_actions_month', (
      SELECT COUNT(*) FROM user_activity_logs
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND module = 'crm'
    ),
    'total_events_today', (
      SELECT COUNT(*) FROM user_activity_logs WHERE created_at >= CURRENT_DATE
    ),
    'total_events_month', (
      SELECT COUNT(*) FROM user_activity_logs WHERE created_at >= date_trunc('month', CURRENT_DATE)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get filtered activity logs with pagination
CREATE OR REPLACE FUNCTION public.get_activity_logs(
  p_user_id_filter uuid DEFAULT NULL,
  p_office_id_filter uuid DEFAULT NULL,
  p_role_filter text DEFAULT NULL,
  p_module_filter text DEFAULT NULL,
  p_event_type_filter text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  result jsonb;
  total_count int;
BEGIN
  SELECT rol INTO v_caller_role FROM usuarios WHERE id = auth.uid();
  IF v_caller_role != 'Administrador' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Count total matching records
  SELECT COUNT(*) INTO total_count
  FROM user_activity_logs al
  WHERE (p_user_id_filter IS NULL OR al.user_id = p_user_id_filter)
    AND (p_office_id_filter IS NULL OR al.office_id = p_office_id_filter)
    AND (p_role_filter IS NULL OR al.role_snapshot = p_role_filter)
    AND (p_module_filter IS NULL OR al.module = p_module_filter)
    AND (p_event_type_filter IS NULL OR al.event_type = p_event_type_filter)
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    AND (p_search IS NULL OR p_search = '' OR
      al.summary ILIKE '%' || p_search || '%' OR
      al.user_name_snapshot ILIKE '%' || p_search || '%' OR
      al.email_snapshot ILIKE '%' || p_search || '%' OR
      al.action ILIKE '%' || p_search || '%'
    );

  -- Get paginated results
  SELECT jsonb_build_object(
    'total', total_count,
    'logs', COALESCE((
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT 
          al.id, al.user_id, al.user_name_snapshot, al.email_snapshot,
          al.office_id, al.office_name_snapshot, al.role_snapshot,
          al.module, al.event_type, al.action, al.entity_type, al.entity_id,
          al.summary, al.details, al.metadata, al.status, al.created_at
        FROM user_activity_logs al
        WHERE (p_user_id_filter IS NULL OR al.user_id = p_user_id_filter)
          AND (p_office_id_filter IS NULL OR al.office_id = p_office_id_filter)
          AND (p_role_filter IS NULL OR al.role_snapshot = p_role_filter)
          AND (p_module_filter IS NULL OR al.module = p_module_filter)
          AND (p_event_type_filter IS NULL OR al.event_type = p_event_type_filter)
          AND (p_date_from IS NULL OR al.created_at >= p_date_from)
          AND (p_date_to IS NULL OR al.created_at <= p_date_to)
          AND (p_search IS NULL OR p_search = '' OR
            al.summary ILIKE '%' || p_search || '%' OR
            al.user_name_snapshot ILIKE '%' || p_search || '%' OR
            al.email_snapshot ILIKE '%' || p_search || '%' OR
            al.action ILIKE '%' || p_search || '%'
          )
        ORDER BY al.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get top active users
CREATE OR REPLACE FUNCTION public.get_top_active_users(p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  result jsonb;
BEGIN
  SELECT rol INTO v_caller_role FROM usuarios WHERE id = auth.uid();
  IF v_caller_role != 'Administrador' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO result
  FROM (
    SELECT 
      al.user_id,
      al.user_name_snapshot as nombre,
      al.role_snapshot as rol,
      al.office_name_snapshot as oficina,
      COUNT(*) as total_actions,
      MAX(al.created_at) as last_activity
    FROM user_activity_logs al
    WHERE al.created_at >= date_trunc('month', CURRENT_DATE)
    GROUP BY al.user_id, al.user_name_snapshot, al.role_snapshot, al.office_name_snapshot
    ORDER BY total_actions DESC
    LIMIT p_limit
  ) r;

  RETURN result;
END;
$$;

-- Function to get top modules
CREATE OR REPLACE FUNCTION public.get_top_modules()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  result jsonb;
BEGIN
  SELECT rol INTO v_caller_role FROM usuarios WHERE id = auth.uid();
  IF v_caller_role != 'Administrador' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO result
  FROM (
    SELECT 
      module,
      COUNT(*) as total_events,
      COUNT(DISTINCT user_id) as unique_users
    FROM user_activity_logs
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
    GROUP BY module
    ORDER BY total_events DESC
  ) r;

  RETURN result;
END;
$$;
