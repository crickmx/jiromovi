/*
  # Add External Contact Support to Centro de Contacto

  ## Problem
  The contact_center_messages table requires agent_user_id (NOT NULL FK→usuarios),
  so inbound WhatsApp messages from external clients (non-registered users) are silently
  dropped by the webhook.

  ## Changes
  1. Make `agent_user_id` nullable in contact_center_messages
  2. Add `contact_phone`, `contact_name`, `conversation_key` columns for external contacts
  3. Drop and recreate get_contact_center_summary to include external conversations
  4. Add indexes for performance
*/

-- 1. Make agent_user_id nullable
ALTER TABLE contact_center_messages
  ALTER COLUMN agent_user_id DROP NOT NULL;

-- 2. Add external contact columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_messages' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE contact_center_messages ADD COLUMN contact_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_messages' AND column_name = 'contact_name'
  ) THEN
    ALTER TABLE contact_center_messages ADD COLUMN contact_name text;
  END IF;
END $$;

-- 3. Index for performance
CREATE INDEX IF NOT EXISTS idx_ccm_contact_phone ON contact_center_messages(contact_phone)
  WHERE contact_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ccm_agent_null_phone ON contact_center_messages(contact_phone, created_at DESC)
  WHERE agent_user_id IS NULL;

-- 4. Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_contact_center_summary(uuid, text, text, uuid, text, integer, integer);

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
  unread_count bigint,
  contact_phone_ext text,
  contact_name_ext text,
  is_external boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  WITH last_msgs_users AS (
    SELECT DISTINCT ON (m.agent_user_id)
      m.agent_user_id,
      NULL::text AS ext_phone,
      NULL::text AS ext_name,
      false AS ext,
      m.body AS last_body,
      m.channel AS last_channel,
      m.created_at AS last_at,
      m.status AS last_status
    FROM contact_center_messages m
    WHERE m.agent_user_id IS NOT NULL
      AND (p_channel IS NULL OR m.channel = p_channel)
      AND (p_message_type IS NULL OR m.message_type = p_message_type)
    ORDER BY m.agent_user_id, m.created_at DESC
  ),
  last_msgs_ext AS (
    SELECT DISTINCT ON (m.contact_phone)
      NULL::uuid AS agent_user_id,
      m.contact_phone AS ext_phone,
      (SELECT m2.contact_name FROM contact_center_messages m2
       WHERE m2.contact_phone = m.contact_phone AND m2.contact_name IS NOT NULL
       ORDER BY m2.created_at DESC LIMIT 1) AS ext_name,
      true AS ext,
      m.body AS last_body,
      m.channel AS last_channel,
      m.created_at AS last_at,
      m.status AS last_status
    FROM contact_center_messages m
    WHERE m.agent_user_id IS NULL
      AND m.contact_phone IS NOT NULL
      AND (p_channel IS NULL OR m.channel = p_channel)
      AND (p_message_type IS NULL OR m.message_type = p_message_type)
    ORDER BY m.contact_phone, m.created_at DESC
  ),
  combined AS (
    SELECT * FROM last_msgs_users
    UNION ALL
    SELECT * FROM last_msgs_ext
  ),
  msg_counts AS (
    SELECT
      COALESCE(m.agent_user_id::text, m.contact_phone) AS conv_key,
      COUNT(*) AS cnt
    FROM contact_center_messages m
    WHERE (p_channel IS NULL OR m.channel = p_channel)
      AND (p_message_type IS NULL OR m.message_type = p_message_type)
    GROUP BY COALESCE(m.agent_user_id::text, m.contact_phone)
  ),
  unread AS (
    SELECT
      COALESCE(m.agent_user_id::text, m.contact_phone) AS conv_key,
      COUNT(*) AS unread_cnt
    FROM contact_center_messages m
    WHERE m.direction = 'inbound' AND m.read_at IS NULL
    GROUP BY COALESCE(m.agent_user_id::text, m.contact_phone)
  ),
  allowed_agents AS (
    SELECT DISTINCT t.agente_usuario_id AS uid
    FROM tickets t
    JOIN ticket_asignaciones ta ON ta.ticket_id = t.id
    WHERE ta.ejecutivo_id = p_user_id
      AND t.cerrado = false
      AND t.agente_usuario_id IS NOT NULL
  )
  SELECT
    c.agent_user_id,
    CASE WHEN c.ext THEN COALESCE(c.ext_name, c.ext_phone) ELSE COALESCE(u.nombre_completo, u.nombre)::text END,
    CASE WHEN c.ext THEN NULL ELSE COALESCE(u.email_laboral, u.email_personal)::text END,
    CASE WHEN c.ext THEN c.ext_phone ELSE COALESCE(u.celular_laboral, u.celular_personal)::text END,
    CASE WHEN c.ext THEN NULL ELSE u.oficina_id END,
    CASE WHEN c.ext THEN NULL ELSE o.nombre::text END,
    CASE WHEN c.ext THEN 'external'::text ELSE u.rol::text END,
    CASE WHEN c.ext THEN true ELSE u.activo END,
    c.last_body::text,
    c.last_channel::text,
    c.last_at,
    c.last_status::text,
    COALESCE(mc.cnt, 0)::bigint,
    COALESCE(ur.unread_cnt, 0)::bigint,
    c.ext_phone::text,
    c.ext_name::text,
    c.ext
  FROM combined c
  LEFT JOIN usuarios u ON u.id = c.agent_user_id
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  LEFT JOIN msg_counts mc ON mc.conv_key = COALESCE(c.agent_user_id::text, c.ext_phone)
  LEFT JOIN unread ur ON ur.conv_key = COALESCE(c.agent_user_id::text, c.ext_phone)
  WHERE (
    v_user_rol = 'Administrador'
    OR (v_user_rol = 'Gerente' AND (c.ext OR u.oficina_id = v_user_office))
    OR (v_user_rol IN ('Empleado', 'Ejecutivo') AND (c.ext OR c.agent_user_id IN (SELECT aa.uid FROM allowed_agents aa)))
  )
  AND (p_office_id IS NULL OR c.ext OR u.oficina_id = p_office_id)
  AND (p_search IS NULL OR (
    (c.ext AND (c.ext_phone ILIKE '%' || p_search || '%' OR c.ext_name ILIKE '%' || p_search || '%'))
    OR (NOT c.ext AND (
      COALESCE(u.nombre_completo, u.nombre) ILIKE '%' || p_search || '%'
      OR COALESCE(u.email_laboral, '') ILIKE '%' || p_search || '%'
      OR COALESCE(u.celular_laboral, '') ILIKE '%' || p_search || '%'
    ))
  ))
  ORDER BY c.last_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contact_center_summary(uuid, text, text, uuid, text, integer, integer) TO authenticated;
