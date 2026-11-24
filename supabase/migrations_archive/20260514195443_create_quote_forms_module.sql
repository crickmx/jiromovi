/*
  # Create Quote Forms Module (Formularios de Cotizacion)

  1. New Tables
    - `quote_forms` - Main table storing quotation form submissions
      - `id` (uuid, PK)
      - `created_at`, `updated_at` (timestamps)
      - `created_by` (uuid, FK to usuarios)
      - `office_id` (uuid, FK to oficinas)
      - `agent_id` (uuid, FK to usuarios)
      - `ticket_id` (uuid, FK to tickets) - linked commercial tramite
      - `folio` (text, unique) - format COT-YYYYMMDD-NNNN
      - `form_type` (text) - e.g. hogar_casa_habitacion, pyme_comercio
      - `form_title` (text) - human-readable title
      - `status` (text) - borrador, enviado, en_revision, etc.
      - `priority` (text) - normal, alta, urgente
      - `client_name` (text, NOT NULL)
      - `client_type` (text) - fisica, moral, no_especificado
      - `client_rfc`, `client_phone`, `client_email`, `client_whatsapp` (nullable)
      - `client_reference`, `client_notes` (nullable text)
      - `client_address_compact` (nullable text)
      - `risk_location_compact` (nullable text)
      - `currency`, `payment_frequency` (nullable text)
      - `start_date`, `end_date` (nullable date)
      - `data_json` (jsonb) - all form data
      - `required_missing_json` (jsonb) - fields still needed
      - `attachments_count` (int, default 0)
      - `submitted_at`, `reviewed_at` (nullable timestamps)
      - `assigned_to` (uuid, FK to usuarios)
      - `notes` (text)

    - `quote_form_attachments` - Files attached to quote forms
      - `id` (uuid, PK)
      - `quote_form_id` (FK)
      - `ticket_id` (FK, nullable)
      - `file_name`, `file_url`, `file_type` (text)
      - `file_size` (bigint)
      - `uploaded_by` (uuid)
      - `category` (text)
      - `created_at`

    - `quote_form_history` - Audit trail for quote forms
      - `id` (uuid, PK)
      - `quote_form_id` (FK)
      - `ticket_id` (FK, nullable)
      - `user_id` (uuid)
      - `event_type` (text)
      - `event_description` (text)
      - `old_status`, `new_status` (nullable text)
      - `metadata_json` (jsonb)
      - `created_at`

    - `quote_form_templates` - Schema definitions for each form type
      - `id` (uuid, PK)
      - `form_type` (text, unique)
      - `title` (text)
      - `description` (text)
      - `category` (text)
      - `icon` (text)
      - `estimated_minutes` (int)
      - `is_active` (boolean)
      - `requires_risk_location` (boolean)
      - `schema_json` (jsonb)
      - `created_at`, `updated_at`

  2. Security
    - RLS enabled on all tables
    - Agents can only see their own forms
    - Gerentes can see forms from their office
    - Admins can see all forms

  3. Functions
    - `generate_quote_form_folio()` - generates sequential folio per day

  4. Indexes
    - Indexes on quote_forms: form_type, status, agent_id, office_id, created_at, folio
*/

-- Generate folio function
CREATE OR REPLACE FUNCTION generate_quote_form_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_str text;
  seq_num int;
  new_folio text;
BEGIN
  today_str := to_char(now(), 'YYYYMMDD');

  SELECT COALESCE(MAX(
    CASE
      WHEN folio ~ ('^COT-' || today_str || '-\d{4}$')
      THEN (substring(folio from '\d{4}$'))::int
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM quote_forms
  WHERE folio LIKE 'COT-' || today_str || '-%';

  new_folio := 'COT-' || today_str || '-' || lpad(seq_num::text, 4, '0');
  RETURN new_folio;
END;
$$;

-- Main quote_forms table
CREATE TABLE IF NOT EXISTS quote_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  office_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  folio text UNIQUE NOT NULL DEFAULT generate_quote_form_folio(),
  form_type text NOT NULL,
  form_title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'borrador',
  priority text NOT NULL DEFAULT 'normal',
  client_name text NOT NULL,
  client_type text DEFAULT 'no_especificado',
  client_rfc text,
  client_phone text,
  client_email text,
  client_whatsapp text,
  client_reference text,
  client_notes text,
  client_address_compact text,
  risk_location_compact text,
  currency text,
  payment_frequency text,
  start_date date,
  end_date date,
  data_json jsonb DEFAULT '{}'::jsonb,
  required_missing_json jsonb DEFAULT '[]'::jsonb,
  attachments_count int DEFAULT 0,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  assigned_to uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  notes text,
  CONSTRAINT quote_forms_status_check CHECK (status IN ('borrador','enviado','en_revision','informacion_incompleta','cotizado','rechazado','emitido','cancelado')),
  CONSTRAINT quote_forms_priority_check CHECK (priority IN ('normal','alta','urgente')),
  CONSTRAINT quote_forms_client_contact CHECK (client_phone IS NOT NULL OR client_email IS NOT NULL OR client_whatsapp IS NOT NULL)
);

-- Attachments table
CREATE TABLE IF NOT EXISTS quote_form_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_form_id uuid NOT NULL REFERENCES quote_forms(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint DEFAULT 0,
  uploaded_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  category text DEFAULT 'otro',
  created_at timestamptz DEFAULT now()
);

-- History table
CREATE TABLE IF NOT EXISTS quote_form_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_form_id uuid NOT NULL REFERENCES quote_forms(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_description text,
  old_status text,
  new_status text,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Templates table
CREATE TABLE IF NOT EXISTS quote_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type text UNIQUE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL,
  icon text DEFAULT 'FileText',
  estimated_minutes int DEFAULT 5,
  is_active boolean DEFAULT true,
  requires_risk_location boolean DEFAULT false,
  schema_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quote_forms_form_type ON quote_forms(form_type);
CREATE INDEX IF NOT EXISTS idx_quote_forms_status ON quote_forms(status);
CREATE INDEX IF NOT EXISTS idx_quote_forms_agent_id ON quote_forms(agent_id);
CREATE INDEX IF NOT EXISTS idx_quote_forms_office_id ON quote_forms(office_id);
CREATE INDEX IF NOT EXISTS idx_quote_forms_created_at ON quote_forms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_forms_folio ON quote_forms(folio);
CREATE INDEX IF NOT EXISTS idx_quote_forms_ticket_id ON quote_forms(ticket_id);
CREATE INDEX IF NOT EXISTS idx_quote_form_attachments_form_id ON quote_form_attachments(quote_form_id);
CREATE INDEX IF NOT EXISTS idx_quote_form_history_form_id ON quote_form_history(quote_form_id);
CREATE INDEX IF NOT EXISTS idx_quote_form_templates_form_type ON quote_form_templates(form_type);
CREATE INDEX IF NOT EXISTS idx_quote_form_templates_category ON quote_form_templates(category);

-- RLS
ALTER TABLE quote_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_form_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_form_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_form_templates ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role without recursion
CREATE OR REPLACE FUNCTION get_user_role_for_quotes(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM usuarios WHERE id = user_uuid AND activo = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_user_office_for_quotes(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oficina_id FROM usuarios WHERE id = user_uuid AND activo = true LIMIT 1;
$$;

-- quote_forms policies
CREATE POLICY "Admins can do everything on quote_forms"
  ON quote_forms FOR ALL TO authenticated
  USING (get_user_role_for_quotes(auth.uid()) IN ('admin','superadmin'));

CREATE POLICY "Gerentes can view office quote_forms"
  ON quote_forms FOR SELECT TO authenticated
  USING (
    get_user_role_for_quotes(auth.uid()) = 'gerente'
    AND office_id = get_user_office_for_quotes(auth.uid())
  );

CREATE POLICY "Gerentes can update office quote_forms"
  ON quote_forms FOR UPDATE TO authenticated
  USING (
    get_user_role_for_quotes(auth.uid()) = 'gerente'
    AND office_id = get_user_office_for_quotes(auth.uid())
  )
  WITH CHECK (
    get_user_role_for_quotes(auth.uid()) = 'gerente'
    AND office_id = get_user_office_for_quotes(auth.uid())
  );

CREATE POLICY "Agents can view own quote_forms"
  ON quote_forms FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Agents can insert own quote_forms"
  ON quote_forms FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Agents can update own draft quote_forms"
  ON quote_forms FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() AND status = 'borrador')
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Empleados can view assigned or office quote_forms"
  ON quote_forms FOR SELECT TO authenticated
  USING (
    get_user_role_for_quotes(auth.uid()) IN ('empleado','ejecutivo')
    AND (
      assigned_to = auth.uid()
      OR office_id = get_user_office_for_quotes(auth.uid())
    )
  );

CREATE POLICY "Empleados can update assigned quote_forms"
  ON quote_forms FOR UPDATE TO authenticated
  USING (
    get_user_role_for_quotes(auth.uid()) IN ('empleado','ejecutivo')
    AND assigned_to = auth.uid()
  )
  WITH CHECK (
    get_user_role_for_quotes(auth.uid()) IN ('empleado','ejecutivo')
    AND assigned_to = auth.uid()
  );

-- quote_form_attachments policies
CREATE POLICY "Users can view attachments of accessible forms"
  ON quote_form_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM quote_forms qf WHERE qf.id = quote_form_id AND (
      qf.agent_id = auth.uid()
      OR qf.created_by = auth.uid()
      OR qf.assigned_to = auth.uid()
      OR get_user_role_for_quotes(auth.uid()) IN ('admin','superadmin')
      OR (get_user_role_for_quotes(auth.uid()) = 'gerente' AND qf.office_id = get_user_office_for_quotes(auth.uid()))
      OR (get_user_role_for_quotes(auth.uid()) IN ('empleado','ejecutivo') AND qf.office_id = get_user_office_for_quotes(auth.uid()))
    ))
  );

CREATE POLICY "Users can insert attachments to their forms"
  ON quote_form_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can delete own attachments"
  ON quote_form_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR get_user_role_for_quotes(auth.uid()) IN ('admin','superadmin'));

-- quote_form_history policies
CREATE POLICY "Users can view history of accessible forms"
  ON quote_form_history FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM quote_forms qf WHERE qf.id = quote_form_id AND (
      qf.agent_id = auth.uid()
      OR qf.created_by = auth.uid()
      OR qf.assigned_to = auth.uid()
      OR get_user_role_for_quotes(auth.uid()) IN ('admin','superadmin')
      OR (get_user_role_for_quotes(auth.uid()) = 'gerente' AND qf.office_id = get_user_office_for_quotes(auth.uid()))
      OR (get_user_role_for_quotes(auth.uid()) IN ('empleado','ejecutivo') AND qf.office_id = get_user_office_for_quotes(auth.uid()))
    ))
  );

CREATE POLICY "Authenticated users can insert history"
  ON quote_form_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- quote_form_templates policies (readable by all authenticated, writable by admins)
CREATE POLICY "All authenticated can read templates"
  ON quote_form_templates FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage templates"
  ON quote_form_templates FOR ALL TO authenticated
  USING (get_user_role_for_quotes(auth.uid()) IN ('admin','superadmin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_quote_forms_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER quote_forms_updated_at
  BEFORE UPDATE ON quote_forms
  FOR EACH ROW EXECUTE FUNCTION update_quote_forms_updated_at();

-- Add formulario_cotizacion to tickets tipo_tramite
DO $$
BEGIN
  -- Check if the constraint exists and alter it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tickets' AND constraint_name LIKE '%tipo_tramite%'
  ) THEN
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_tipo_tramite_check;
  END IF;
END $$;

-- Add broader constraint that includes new type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'quote_form_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN quote_form_id uuid REFERENCES quote_forms(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_quote_form_id ON tickets(quote_form_id);
