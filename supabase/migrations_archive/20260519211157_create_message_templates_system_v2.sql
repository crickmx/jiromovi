/*
  # Message Templates and Form Slugs System

  ## Summary
  1. Add slug, allowed_roles, is_global to quote_form_templates
  2. Create message_templates table with RLS
  3. Create message_template_offices (sharing) table with RLS
  4. Create contact_message_log table with RLS
  5. Seed 5 default global templates
*/

-- ============================================================
-- 1. Add columns to quote_form_templates
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_form_templates' AND column_name = 'slug') THEN
    ALTER TABLE quote_form_templates ADD COLUMN slug text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_form_templates' AND column_name = 'allowed_roles') THEN
    ALTER TABLE quote_form_templates ADD COLUMN allowed_roles jsonb DEFAULT '["Administrador","Gerente","Empleado","Agente","Ejecutivo"]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_form_templates' AND column_name = 'is_global') THEN
    ALTER TABLE quote_form_templates ADD COLUMN is_global boolean DEFAULT true;
  END IF;
END $$;

UPDATE quote_form_templates SET slug = form_type WHERE slug IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'quote_form_templates' AND constraint_name = 'quote_form_templates_slug_key'
  ) THEN
    ALTER TABLE quote_form_templates ADD CONSTRAINT quote_form_templates_slug_key UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qft_slug ON quote_form_templates (slug);

-- ============================================================
-- 2. message_templates table
-- ============================================================

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  content text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  is_active boolean DEFAULT true,
  is_global boolean DEFAULT false,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  office_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mt_created_by ON message_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_mt_office_id ON message_templates (office_id);
CREATE INDEX IF NOT EXISTS idx_mt_is_active ON message_templates (is_active);
CREATE INDEX IF NOT EXISTS idx_mt_category ON message_templates (category);

CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trig_mt_updated_at ON message_templates;
CREATE TRIGGER trig_mt_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_message_templates_updated_at();

-- ============================================================
-- 3. message_template_offices (sharing)
-- ============================================================

CREATE TABLE IF NOT EXISTS message_template_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (template_id, office_id)
);

ALTER TABLE message_template_offices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mto_template_id ON message_template_offices (template_id);
CREATE INDEX IF NOT EXISTS idx_mto_office_id ON message_template_offices (office_id);

-- ============================================================
-- 4. contact_message_log
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_center_message_id uuid REFERENCES contact_center_messages(id) ON DELETE SET NULL,
  sender_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  agent_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  message_text text NOT NULL,
  template_id uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  form_template_id uuid REFERENCES quote_form_templates(id) ON DELETE SET NULL,
  form_link text,
  form_slug text,
  status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_message_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cml_sender ON contact_message_log (sender_user_id);
CREATE INDEX IF NOT EXISTS idx_cml_agent ON contact_message_log (agent_user_id);
CREATE INDEX IF NOT EXISTS idx_cml_created_at ON contact_message_log (created_at DESC);

-- ============================================================
-- 5. RLS Policies
-- ============================================================

-- message_templates: SELECT (own + global + shared with my office)
CREATE POLICY "Users can view accessible message templates"
  ON message_templates FOR SELECT
  TO authenticated
  USING (
    is_active = true AND (
      created_by = (SELECT auth.uid())
      OR is_global = true
      OR EXISTS (
        SELECT 1 FROM message_template_offices mto
        JOIN usuarios u ON u.oficina_id = mto.office_id
        WHERE mto.template_id = message_templates.id
          AND u.id = (SELECT auth.uid())
          AND u.activo = true
      )
    )
  );

CREATE POLICY "Authenticated users can insert message templates"
  ON message_templates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Creators and admins can update message templates"
  ON message_templates FOR UPDATE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.rol = 'Administrador' AND u.activo = true
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.rol = 'Administrador' AND u.activo = true
    )
  );

CREATE POLICY "Creators and admins can delete message templates"
  ON message_templates FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.rol = 'Administrador' AND u.activo = true
    )
  );

-- message_template_offices policies
CREATE POLICY "Users can view template office shares"
  ON message_template_offices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Template creators and admins can manage shares"
  ON message_template_offices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM message_templates mt
      WHERE mt.id = template_id
        AND (
          mt.created_by = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.rol = 'Administrador' AND u.activo = true
          )
        )
    )
  );

CREATE POLICY "Template creators and admins can delete shares"
  ON message_template_offices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM message_templates mt
      WHERE mt.id = template_id
        AND (
          mt.created_by = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.rol = 'Administrador' AND u.activo = true
          )
        )
    )
  );

-- contact_message_log policies
CREATE POLICY "Users can view own sent logs"
  ON contact_message_log FOR SELECT
  TO authenticated
  USING (
    sender_user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = (SELECT auth.uid()) AND u.rol = 'Administrador' AND u.activo = true
    )
  );

CREATE POLICY "Authenticated users can insert logs"
  ON contact_message_log FOR INSERT
  TO authenticated
  WITH CHECK (sender_user_id = (SELECT auth.uid()));

-- ============================================================
-- 6. Seed default global templates
-- ============================================================

DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM usuarios WHERE rol = 'Administrador' AND activo = true LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO message_templates (name, category, content, channel, is_global, created_by, variables) VALUES
    ('Compartir Formulario','Formularios',
     'Hola {{nombre_contacto}}, te comparto el formulario de {{nombre_formulario}} para que puedas completar la informacion necesaria:' || chr(10) || '{{link_formulario}}' || chr(10) || chr(10) || 'Quedo atento por este medio si tienes cualquier duda.',
     'whatsapp', true, admin_id, '["nombre_contacto","nombre_formulario","link_formulario"]'::jsonb),
    ('Bienvenida','Bienvenida',
     'Hola {{nombre_contacto}}, bienvenido a {{nombre_oficina}}. Soy {{nombre_usuario}} y estare atendiendo tu caso. Quedamos a tus ordenes.',
     'whatsapp', true, admin_id, '["nombre_contacto","nombre_oficina","nombre_usuario"]'::jsonb),
    ('Seguimiento de Cotizacion','Seguimiento',
     'Hola {{nombre_contacto}}, espero que estes bien. Te escribo para dar seguimiento a la cotizacion que solicitaste. Tienes alguna duda o necesitas informacion adicional?',
     'whatsapp', true, admin_id, '["nombre_contacto"]'::jsonb),
    ('Recordatorio de Documentos','Documentos',
     'Hola {{nombre_contacto}}, para continuar con tu tramite necesitamos que nos envies los siguientes documentos. Puedes compartirlos por este medio. Gracias.',
     'whatsapp', true, admin_id, '["nombre_contacto"]'::jsonb),
    ('Aviso de Renovacion','Renovacion',
     'Hola {{nombre_contacto}}, te informamos que tu poliza esta proxima a vencer. Para renovarla sin interrupciones, comunicate con nosotros a la brevedad.',
     'whatsapp', true, admin_id, '["nombre_contacto"]'::jsonb)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
