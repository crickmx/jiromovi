/*
  # Role-based visibility for Centro de Contacto

  1. Changes
    - Updated `get_contact_center_summary` function to apply role-based filtering:
      - Administrador: sees ALL agent conversations
      - Gerente: sees conversations of agents from their office only
      - Empleado/Ejecutivo: sees only conversations of agents assigned to them via open tramites (ticket_asignaciones)

  2. Security
    - Function remains SECURITY DEFINER with restricted search_path
    - Each role only accesses data they are authorized to see
*/

CREATE OR REPLACE FUNCTION public.get_contact_center_summary(
  p_user_id uuid,
  p_channel text DEFAULT NULL,
  p_message_type text DEFAULT NULL,
  p_office_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  agent_user_id uuid,
  agent_name text,
  agent_email text,
  agent_phone text,
  agent_office_id uuid,
  office_name text,
  agent_rol text,
  agent_activo boolean,
  last_message_body text,
  last_message_channel text,
  last_message_at timestamptz,
  last_message_status text,
  total_messages bigint,
  unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_rol text;
  v_user_office uuid;
BEGIN
  SELECT u.rol, u.oficina_id INTO v_user_rol, v_user_office
  FROM usuarios u WHERE u.id = p_user_id;

  IF v_user_rol IS NULL OR v_user_rol NOT IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo') THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH last_msgs AS (
    SELECT DISTINCT ON (m.agent_user_id)
      m.agent_user_id,
      m.body AS last_body,
      m.channel AS last_channel,
      m.created_at AS last_at,
      m.status AS last_status
    FROM contact_center_messages m
    WHERE (p_channel IS NULL OR m.channel = p_channel)
      AND (p_message_type IS NULL OR m.message_type = p_message_type)
    ORDER BY m.agent_user_id, m.created_at DESC
  ),
  msg_counts AS (
    SELECT m.agent_user_id, COUNT(*) AS cnt
    FROM contact_center_messages m
    WHERE (p_channel IS NULL OR m.channel = p_channel)
      AND (p_message_type IS NULL OR m.message_type = p_message_type)
    GROUP BY m.agent_user_id
  ),
  unread AS (
    SELECT m.agent_user_id, COUNT(*) AS unread_cnt
    FROM contact_center_messages m
    WHERE m.direction = 'inbound' AND m.read_at IS NULL
    GROUP BY m.agent_user_id
  ),
  allowed_agents AS (
    SELECT DISTINCT t.agente_usuario_id AS uid
    FROM tickets t
    JOIN ticket_asignaciones ta ON ta.ticket_id = t.id
    WHERE ta.ejecutivo_id = p_user_id
      AND t.cerrado = false
      AND t.agente_usuario_id IS NOT NULL
  )
  SELECT lm.agent_user_id,
    COALESCE(u.nombre_completo, u.nombre)::text,
    COALESCE(u.email_laboral, u.email_personal)::text,
    COALESCE(u.celular_laboral, u.celular_personal)::text,
    u.oficina_id, o.nombre::text, u.rol::text, u.activo,
    lm.last_body::text, lm.last_channel::text, lm.last_at, lm.last_status::text,
    COALESCE(mc.cnt, 0)::bigint, COALESCE(ur.unread_cnt, 0)::bigint
  FROM last_msgs lm
  JOIN usuarios u ON u.id = lm.agent_user_id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  LEFT JOIN msg_counts mc ON mc.agent_user_id = lm.agent_user_id
  LEFT JOIN unread ur ON ur.agent_user_id = lm.agent_user_id
  WHERE (
    v_user_rol = 'Administrador'
    OR (v_user_rol = 'Gerente' AND u.oficina_id = v_user_office)
    OR (v_user_rol IN ('Empleado', 'Ejecutivo') AND lm.agent_user_id IN (SELECT aa.uid FROM allowed_agents aa))
  )
  AND (p_office_id IS NULL OR u.oficina_id = p_office_id)
  AND (p_search IS NULL OR (
    COALESCE(u.nombre_completo, u.nombre) ILIKE '%' || p_search || '%'
    OR COALESCE(u.email_laboral, '') ILIKE '%' || p_search || '%'
    OR COALESCE(u.celular_laboral, '') ILIKE '%' || p_search || '%'
  ))
  ORDER BY lm.last_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
