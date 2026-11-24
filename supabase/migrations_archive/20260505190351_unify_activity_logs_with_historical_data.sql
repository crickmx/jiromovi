/*
  # Unify Activity Logs with Historical Data

  1. Purpose
    - Replace the `get_activity_logs` function to also pull historical data from:
      - ticket_historial (643 records - tramites/CRM actions)
      - audit_logs (39 records - admin actions: activate/deactivate users)
      - correo_historial_envios (614 records - email/whatsapp notifications sent)
      - centro_digital_auditoria (12 records - file uploads/downloads)
    - Replace `get_activity_kpis` to compute KPIs from the unified dataset
    - Replace `get_top_active_users` and `get_top_modules` similarly

  2. Approach
    - Create a VIEW `unified_activity_view` that UNIONs all sources
    - Each source is mapped to the same column shape as user_activity_logs
    - Functions query this view instead of only user_activity_logs

  3. Important Notes
    - No data is deleted or moved - purely additive
    - Historical records get mapped module/event_type values matching the new system
    - The view uses UNION ALL for performance (no dedup needed across tables)
*/

-- Create the unified activity view
CREATE OR REPLACE VIEW public.unified_activity_view AS

-- Source 1: user_activity_logs (new instrumentation)
SELECT
  id,
  user_id,
  user_name_snapshot,
  email_snapshot,
  office_id,
  office_name_snapshot,
  role_snapshot,
  module,
  event_type,
  action,
  entity_type,
  entity_id,
  summary,
  details,
  metadata,
  status,
  created_at
FROM user_activity_logs

UNION ALL

-- Source 2: ticket_historial (tramites module)
SELECT
  th.id,
  th.usuario_id AS user_id,
  COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos, 'Desconocido') AS user_name_snapshot,
  u.email_laboral AS email_snapshot,
  u.oficina_id AS office_id,
  o.nombre AS office_name_snapshot,
  u.rol AS role_snapshot,
  'tramites'::text AS module,
  'tramites'::text AS event_type,
  CASE
    WHEN th.tipo_accion = 'estatus' THEN 'tramite_status_change'
    WHEN th.tipo_accion = 'comentario' THEN 'tramite_comment'
    WHEN th.tipo_accion = 'asignacion' THEN 'tramite_assignment'
    WHEN th.tipo_accion = 'archivo' THEN 'tramite_file'
    ELSE COALESCE(th.tipo_accion, 'tramite_action')
  END AS action,
  'ticket'::text AS entity_type,
  th.ticket_id::text AS entity_id,
  COALESCE(th.descripcion, th.accion, 'Accion en tramite') AS summary,
  COALESCE(th.detalle, '{}'::jsonb) AS details,
  '{}'::jsonb AS metadata,
  'success'::text AS status,
  th.fecha_hora AS created_at
FROM ticket_historial th
LEFT JOIN usuarios u ON u.id = th.usuario_id
LEFT JOIN oficinas o ON o.id = u.oficina_id
WHERE th.usuario_id IS NOT NULL

UNION ALL

-- Source 3: audit_logs (system/admin actions)
SELECT
  al.id,
  al.performed_by AS user_id,
  COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos, 'Desconocido') AS user_name_snapshot,
  u.email_laboral AS email_snapshot,
  u.oficina_id AS office_id,
  o.nombre AS office_name_snapshot,
  u.rol AS role_snapshot,
  'system'::text AS module,
  'system'::text AS event_type,
  al.action AS action,
  COALESCE(al.target_resource_type, 'system')::text AS entity_type,
  al.target_user_id::text AS entity_id,
  CASE
    WHEN al.action = 'activate_user' THEN 'Activo usuario: ' || COALESCE(al.details->>'target_nombre', '')
    WHEN al.action = 'deactivate_user' THEN 'Desactivo usuario: ' || COALESCE(al.details->>'target_nombre', '')
    WHEN al.action = 'soft_delete_user' THEN 'Elimino usuario: ' || COALESCE(al.details->>'target_nombre', '')
    ELSE 'Accion administrativa: ' || al.action
  END AS summary,
  COALESCE(al.details, '{}'::jsonb) AS details,
  jsonb_build_object('ip', COALESCE(al.ip_address, ''), 'ua', COALESCE(al.user_agent, '')) AS metadata,
  'success'::text AS status,
  al.created_at
FROM audit_logs al
LEFT JOIN usuarios u ON u.id = al.performed_by
LEFT JOIN oficinas o ON o.id = u.oficina_id
WHERE al.performed_by IS NOT NULL

UNION ALL

-- Source 4: correo_historial_envios (notifications sent)
SELECT
  ch.id,
  COALESCE(ch.enviado_por, ch.usuario_id, ch.destinatario_id) AS user_id,
  COALESCE(ch.destinatario_nombre, u.nombre_completo, 'Sistema') AS user_name_snapshot,
  COALESCE(ch.destinatario_email, u.email_laboral) AS email_snapshot,
  u.oficina_id AS office_id,
  o.nombre AS office_name_snapshot,
  u.rol AS role_snapshot,
  'system'::text AS module,
  'system'::text AS event_type,
  'notification_sent'::text AS action,
  COALESCE(ch.canal_envio, 'correo')::text AS entity_type,
  ch.tipo_notificacion_codigo::text AS entity_id,
  CASE
    WHEN ch.canal_envio = 'whatsapp' THEN 'WhatsApp enviado: ' || COALESCE(ch.tipo_notificacion_codigo, '')
    ELSE 'Correo enviado: ' || COALESCE(ch.asunto, ch.tipo_notificacion_codigo, '')
  END AS summary,
  jsonb_build_object('estado', ch.estado, 'canal', ch.canal_envio, 'tipo', ch.tipo_notificacion_codigo) AS details,
  '{}'::jsonb AS metadata,
  CASE WHEN ch.estado = 'enviado' THEN 'success' WHEN ch.estado = 'error' THEN 'error' ELSE 'warning' END AS status,
  COALESCE(ch.fecha_envio, ch.created_at) AS created_at
FROM correo_historial_envios ch
LEFT JOIN usuarios u ON u.id = COALESCE(ch.enviado_por, ch.usuario_id, ch.destinatario_id)
LEFT JOIN oficinas o ON o.id = u.oficina_id
WHERE COALESCE(ch.enviado_por, ch.usuario_id, ch.destinatario_id) IS NOT NULL

UNION ALL

-- Source 5: centro_digital_auditoria (file actions)
SELECT
  cda.id,
  cda.usuario_id AS user_id,
  COALESCE(u.nombre_completo, u.nombre || ' ' || u.apellidos, 'Desconocido') AS user_name_snapshot,
  u.email_laboral AS email_snapshot,
  u.oficina_id AS office_id,
  o.nombre AS office_name_snapshot,
  u.rol AS role_snapshot,
  'centro_digital'::text AS module,
  'digital'::text AS event_type,
  cda.accion AS action,
  'file'::text AS entity_type,
  COALESCE(cda.archivo_id::text, cda.carpeta_id::text) AS entity_id,
  CASE
    WHEN cda.accion = 'archivo_subido' THEN 'Subio archivo: ' || COALESCE(cda.detalles->>'nombre', '')
    WHEN cda.accion = 'archivo_descargado' THEN 'Descargo archivo: ' || COALESCE(cda.detalles->>'nombre', '')
    WHEN cda.accion = 'archivo_eliminado' THEN 'Elimino archivo: ' || COALESCE(cda.detalles->>'nombre', '')
    WHEN cda.accion = 'carpeta_creada' THEN 'Creo carpeta: ' || COALESCE(cda.detalles->>'nombre', '')
    ELSE 'Accion: ' || cda.accion
  END AS summary,
  COALESCE(cda.detalles, '{}'::jsonb) AS details,
  '{}'::jsonb AS metadata,
  'success'::text AS status,
  cda.created_at
FROM centro_digital_auditoria cda
LEFT JOIN usuarios u ON u.id = cda.usuario_id
LEFT JOIN oficinas o ON o.id = u.oficina_id
WHERE cda.usuario_id IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.unified_activity_view TO authenticated;
GRANT SELECT ON public.unified_activity_view TO service_role;

-- Replace get_activity_logs to use the unified view
CREATE OR REPLACE FUNCTION get_activity_logs(
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
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
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
  FROM unified_activity_view al
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
        FROM unified_activity_view al
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

-- Replace get_activity_kpis to use unified view
CREATE OR REPLACE FUNCTION get_activity_kpis()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
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
      SELECT COUNT(DISTINCT user_id) FROM unified_activity_view
      WHERE created_at >= CURRENT_DATE
    ),
    'active_this_week', (
      SELECT COUNT(DISTINCT user_id) FROM unified_activity_view
      WHERE created_at >= date_trunc('week', CURRENT_DATE)
    ),
    'active_this_month', (
      SELECT COUNT(DISTINCT user_id) FROM unified_activity_view
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
    ),
    'total_logins_today', (
      SELECT COUNT(*) FROM unified_activity_view
      WHERE created_at >= CURRENT_DATE AND action = 'login'
    ),
    'total_logins_week', (
      SELECT COUNT(*) FROM unified_activity_view
      WHERE created_at >= date_trunc('week', CURRENT_DATE) AND action = 'login'
    ),
    'inactive_users', (
      SELECT COUNT(*) FROM usuarios u
      WHERE u.activo = true AND u.rol != 'Administrador'
      AND NOT EXISTS (
        SELECT 1 FROM unified_activity_view al
        WHERE al.user_id = u.id AND al.created_at >= CURRENT_DATE - interval '30 days'
      )
    ),
    'profile_changes_month', (
      SELECT COUNT(*) FROM unified_activity_view
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND event_type = 'profile'
    ),
    'publicity_created_month', (
      SELECT COUNT(*) FROM unified_activity_view
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND module = 'publicidad'
    ),
    'courses_started_month', (
      SELECT COUNT(*) FROM unified_activity_view
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND action = 'course_start'
    ),
    'courses_completed_month', (
      SELECT COUNT(*) FROM unified_activity_view
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND action = 'course_complete'
    ),
    'tramites_responded_month', (
      SELECT COUNT(*) FROM unified_activity_view
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND module = 'tramites'
    ),
    'crm_actions_month', (
      SELECT COUNT(*) FROM unified_activity_view
      WHERE created_at >= date_trunc('month', CURRENT_DATE) AND module = 'crm'
    ),
    'total_events_today', (
      SELECT COUNT(*) FROM unified_activity_view WHERE created_at >= CURRENT_DATE
    ),
    'total_events_month', (
      SELECT COUNT(*) FROM unified_activity_view WHERE created_at >= date_trunc('month', CURRENT_DATE)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Replace get_top_active_users to use unified view
CREATE OR REPLACE FUNCTION get_top_active_users()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT rol INTO v_caller_role FROM usuarios WHERE id = auth.uid();
  IF v_caller_role != 'Administrador' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        al.user_id,
        al.user_name_snapshot AS nombre,
        al.role_snapshot AS rol,
        al.office_name_snapshot AS oficina,
        COUNT(*) AS total_acciones,
        MAX(al.created_at) AS ultima_actividad
      FROM unified_activity_view al
      WHERE al.created_at >= date_trunc('month', CURRENT_DATE)
        AND al.user_id IS NOT NULL
      GROUP BY al.user_id, al.user_name_snapshot, al.role_snapshot, al.office_name_snapshot
      ORDER BY total_acciones DESC
      LIMIT 8
    ) r
  ), '[]'::jsonb);
END;
$$;

-- Replace get_top_modules to use unified view
CREATE OR REPLACE FUNCTION get_top_modules()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT rol INTO v_caller_role FROM usuarios WHERE id = auth.uid();
  IF v_caller_role != 'Administrador' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        al.module,
        COUNT(*) AS total,
        COUNT(DISTINCT al.user_id) AS usuarios_unicos
      FROM unified_activity_view al
      WHERE al.created_at >= date_trunc('month', CURRENT_DATE)
      GROUP BY al.module
      ORDER BY total DESC
      LIMIT 10
    ) r
  ), '[]'::jsonb);
END;
$$;
