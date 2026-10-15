/*
  # Enhance Contact Center - Bidirectional WhatsApp & Task Linking

  1. Modified Tables
    - `contact_center_messages` - Add read_by_user_id, update status constraint
    - `task_contact_center_items` - Add task_id, contact_center_attachment_id columns

  2. New Tables
    - `contact_center_attachments` - Files received/sent via WhatsApp
    - `contact_center_audit_log` - Audit trail for actions

  3. New Functions
    - `mark_contact_messages_read` - Marks inbound messages as read
    - `assign_unassigned_conversation` - Links unassigned messages to an agent
    - Updated `get_contact_center_summary` with unread_count

  4. Security
    - RLS on all new tables with role-based access
    - Storage bucket for attachments
*/

-- ============================================================
-- Step 1: Update contact_center_messages
-- ============================================================

DO $$
BEGIN
  ALTER TABLE contact_center_messages DROP CONSTRAINT IF EXISTS contact_center_messages_status_check;
  ALTER TABLE contact_center_messages ADD CONSTRAINT contact_center_messages_status_check
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'received'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_center_messages' AND column_name = 'read_by_user_id'
  ) THEN
    ALTER TABLE contact_center_messages ADD COLUMN read_by_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ccm_unread_inbound
  ON contact_center_messages (agent_user_id, direction, read_at)
  WHERE direction = 'inbound' AND read_at IS NULL;

-- ============================================================
-- Step 2: Create contact_center_attachments
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_center_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES contact_center_messages(id) ON DELETE CASCADE,
  agent_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  provider text,
  provider_file_id text,
  file_name text NOT NULL DEFAULT 'archivo',
  file_type text NOT NULL DEFAULT 'document',
  mime_type text,
  file_url text,
  storage_path text,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cca_message_id ON contact_center_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_cca_agent_user_id ON contact_center_attachments(agent_user_id);

ALTER TABLE contact_center_attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_center_attachments' AND policyname = 'Admins view all cc attachments') THEN
    CREATE POLICY "Admins view all cc attachments"
      ON contact_center_attachments FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_center_attachments' AND policyname = 'Gerentes view office cc attachments') THEN
    CREATE POLICY "Gerentes view office cc attachments"
      ON contact_center_attachments FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid() AND u.rol = 'Gerente' AND u.activo = true
        AND (contact_center_attachments.agent_user_id IS NULL OR contact_center_attachments.agent_user_id IN (SELECT uu.id FROM usuarios uu WHERE uu.oficina_id = u.oficina_id))
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_center_attachments' AND policyname = 'Empleados view office cc attachments') THEN
    CREATE POLICY "Empleados view office cc attachments"
      ON contact_center_attachments FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid() AND u.rol = 'Empleado' AND u.activo = true
        AND (contact_center_attachments.agent_user_id IS NULL OR contact_center_attachments.agent_user_id IN (SELECT uu.id FROM usuarios uu WHERE uu.oficina_id = u.oficina_id))
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_center_attachments' AND policyname = 'Auth users insert cc attachments') THEN
    CREATE POLICY "Auth users insert cc attachments"
      ON contact_center_attachments FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador', 'Gerente', 'Empleado')));
  END IF;
END $$;

-- ============================================================
-- Step 3: Alter task_contact_center_items
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_contact_center_items' AND column_name = 'task_id') THEN
    ALTER TABLE task_contact_center_items ADD COLUMN task_id uuid REFERENCES crm_tareas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_contact_center_items' AND column_name = 'contact_center_attachment_id') THEN
    ALTER TABLE task_contact_center_items ADD COLUMN contact_center_attachment_id uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tcci_task_id ON task_contact_center_items(task_id);
CREATE INDEX IF NOT EXISTS idx_tcci_message_id ON task_contact_center_items(contact_center_message_id);

ALTER TABLE task_contact_center_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_contact_center_items' AND policyname = 'Users view own linked items') THEN
    CREATE POLICY "Users view own linked items"
      ON task_contact_center_items FOR SELECT TO authenticated
      USING (added_by_user_id = auth.uid() OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_contact_center_items' AND policyname = 'Users insert linked items') THEN
    CREATE POLICY "Users insert linked items"
      ON task_contact_center_items FOR INSERT TO authenticated
      WITH CHECK (added_by_user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- Step 4: Create contact_center_audit_log
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_center_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  agent_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  action text NOT NULL,
  task_id uuid REFERENCES crm_tareas(id) ON DELETE SET NULL,
  message_ids uuid[] DEFAULT '{}',
  attachment_ids uuid[] DEFAULT '{}',
  result text DEFAULT 'success',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccal_user_id ON contact_center_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ccal_created_at ON contact_center_audit_log(created_at DESC);

ALTER TABLE contact_center_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_center_audit_log' AND policyname = 'Users view own cc audit logs') THEN
    CREATE POLICY "Users view own cc audit logs"
      ON contact_center_audit_log FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_center_audit_log' AND policyname = 'Users insert cc audit logs') THEN
    CREATE POLICY "Users insert cc audit logs"
      ON contact_center_audit_log FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- Step 5: Functions
-- ============================================================

CREATE OR REPLACE FUNCTION mark_contact_messages_read(p_agent_user_id uuid, p_user_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  UPDATE contact_center_messages SET read_at = now(), read_by_user_id = p_user_id
  WHERE agent_user_id = p_agent_user_id AND direction = 'inbound' AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION assign_unassigned_conversation(p_old_agent_id uuid, p_new_agent_id uuid, p_assigned_by uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  UPDATE contact_center_messages
  SET agent_user_id = p_new_agent_id,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('reassigned_from', p_old_agent_id::text, 'reassigned_by', p_assigned_by::text, 'reassigned_at', now()::text)
  WHERE agent_user_id = p_old_agent_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE contact_center_attachments SET agent_user_id = p_new_agent_id WHERE agent_user_id = p_old_agent_id;
  RETURN v_count;
END;
$$;

-- Drop old function signature and recreate with unread_count
DROP FUNCTION IF EXISTS get_contact_center_summary(uuid, text, text, uuid, text, int, int);

CREATE OR REPLACE FUNCTION get_contact_center_summary(
  p_user_id uuid, p_channel text DEFAULT NULL, p_message_type text DEFAULT NULL,
  p_office_id uuid DEFAULT NULL, p_search text DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0
)
RETURNS TABLE (
  agent_user_id uuid, agent_name text, agent_email text, agent_phone text,
  agent_office_id uuid, office_name text, agent_rol text, agent_activo boolean,
  last_message_body text, last_message_channel text, last_message_at timestamptz,
  last_message_status text, total_messages bigint, unread_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_rol text; v_user_office uuid;
BEGIN
  SELECT u.rol, u.oficina_id INTO v_user_rol, v_user_office FROM usuarios u WHERE u.id = p_user_id;
  IF v_user_rol IS NULL OR v_user_rol NOT IN ('Administrador', 'Gerente', 'Empleado', 'Ejecutivo') THEN RETURN; END IF;

  RETURN QUERY
  WITH last_msgs AS (
    SELECT DISTINCT ON (m.agent_user_id) m.agent_user_id, m.body AS last_body, m.channel AS last_channel, m.created_at AS last_at, m.status AS last_status
    FROM contact_center_messages m
    WHERE (p_channel IS NULL OR m.channel = p_channel) AND (p_message_type IS NULL OR m.message_type = p_message_type)
    ORDER BY m.agent_user_id, m.created_at DESC
  ),
  msg_counts AS (
    SELECT m.agent_user_id, COUNT(*) AS cnt FROM contact_center_messages m
    WHERE (p_channel IS NULL OR m.channel = p_channel) AND (p_message_type IS NULL OR m.message_type = p_message_type)
    GROUP BY m.agent_user_id
  ),
  unread AS (
    SELECT m.agent_user_id, COUNT(*) AS unread_cnt FROM contact_center_messages m
    WHERE m.direction = 'inbound' AND m.read_at IS NULL GROUP BY m.agent_user_id
  )
  SELECT lm.agent_user_id,
    COALESCE(u.nombre_completo, u.nombres || ' ' || u.apellido_paterno)::text,
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
  WHERE (v_user_rol = 'Administrador' OR u.oficina_id = v_user_office)
    AND (p_office_id IS NULL OR u.oficina_id = p_office_id)
    AND (p_search IS NULL OR (
      COALESCE(u.nombre_completo, u.nombres || ' ' || u.apellido_paterno) ILIKE '%' || p_search || '%'
      OR COALESCE(u.email_laboral, '') ILIKE '%' || p_search || '%'
      OR COALESCE(u.celular_laboral, '') ILIKE '%' || p_search || '%'
    ))
  ORDER BY lm.last_at DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ============================================================
-- Step 6: Enable realtime
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE contact_center_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- Step 7: Storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contact-center-attachments', 'contact-center-attachments', false, 52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf','audio/mpeg','audio/ogg','audio/wav','audio/mp4','video/mp4','video/quicktime','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth read cc attachments storage') THEN
    CREATE POLICY "Auth read cc attachments storage" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contact-center-attachments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Auth upload cc attachments storage') THEN
    CREATE POLICY "Auth upload cc attachments storage" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contact-center-attachments');
  END IF;
END $$;
