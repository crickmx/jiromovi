/*
  # Seguwallet External Policies Module

  ## Summary
  Allows Seguwallet customers to store and manage insurance policies that are NOT
  tracked in SICAS — acting as a personal insurance vault.

  ## New Tables
  1. `seguwallet_external_policies` — main policy record (customer-owned)
  2. `seguwallet_external_policy_documents` — files attached to a policy
  3. `seguwallet_external_policy_logs` — audit trail for all mutations

  ## Security
  - Customer: full CRUD on own records; upload/download own documents
  - Agent (rol = 'agente'): SELECT only on policies/docs of their linked customers
  - Admin: SELECT on all; no mutation
  - RLS enabled on all tables; storage bucket policies in a separate migration

  ## Notes
  - `deleted_at` soft-delete pattern (no hard deletes)
  - `vehicle_data`, `health_life_data`, `custom_data` are flexible JSONB for
    ramo-specific optional fields
  - `insurer_id` references `aseguradoras_web` (existing catalogue) — nullable
    for "other" free-text entries
*/

-- ─── 1. Main policy table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seguwallet_external_policies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguwallet_customer_id uuid NOT NULL REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  agent_user_id         uuid NOT NULL,  -- agent who owns the Seguwallet account link
  insurer_name          text NOT NULL,
  insurer_id            uuid NULL,      -- optional FK to aseguradoras_web catalogue
  ramo                  text NOT NULL DEFAULT '',
  subramo               text NOT NULL,
  policy_number         text NOT NULL,
  contractor_name       text NULL,
  insured_name          text NULL,
  start_date            date NULL,
  end_date              date NULL,
  status                text NOT NULL DEFAULT 'active',
  total_premium         numeric(14, 2) NULL,
  currency              text NOT NULL DEFAULT 'MXN',
  payment_method        text NULL,
  payment_frequency     text NULL,
  notes                 text NULL,
  insurer_phone         text NULL,
  insurer_website       text NULL,
  beneficiaries         text NULL,
  vehicle_data          jsonb NULL,     -- placas, vin, modelo, anio
  health_life_data      jsonb NULL,     -- suma asegurada, deducible, etc.
  custom_data           jsonb NULL,     -- free-form extras
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz NULL
);

ALTER TABLE seguwallet_external_policies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ext_policies_customer ON seguwallet_external_policies(seguwallet_customer_id);
CREATE INDEX IF NOT EXISTS idx_ext_policies_agent ON seguwallet_external_policies(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_ext_policies_status ON seguwallet_external_policies(status) WHERE deleted_at IS NULL;

-- ─── 2. Documents table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seguwallet_external_policy_documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_policy_id    uuid NOT NULL REFERENCES seguwallet_external_policies(id) ON DELETE CASCADE,
  seguwallet_customer_id uuid NOT NULL REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  document_type         text NOT NULL DEFAULT 'Otro',
  document_name         text NULL,
  file_url              text NOT NULL,
  file_path             text NULL,
  file_size             bigint NULL,
  mime_type             text NULL,
  uploaded_by           uuid NOT NULL,
  uploaded_by_type      text NOT NULL DEFAULT 'seguwallet_customer',
  created_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz NULL
);

ALTER TABLE seguwallet_external_policy_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ext_docs_policy ON seguwallet_external_policy_documents(external_policy_id);
CREATE INDEX IF NOT EXISTS idx_ext_docs_customer ON seguwallet_external_policy_documents(seguwallet_customer_id);

-- ─── 3. Audit log table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seguwallet_external_policy_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_policy_id    uuid NULL REFERENCES seguwallet_external_policies(id) ON DELETE SET NULL,
  seguwallet_customer_id uuid NULL,
  actor_id              uuid NULL,
  actor_type            text NULL,  -- 'seguwallet_customer' | 'agent' | 'admin'
  event_type            text NOT NULL, -- 'created' | 'updated' | 'deleted' | 'doc_uploaded' | 'doc_downloaded' | 'agent_viewed'
  metadata              jsonb NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seguwallet_external_policy_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ext_logs_policy ON seguwallet_external_policy_logs(external_policy_id);
CREATE INDEX IF NOT EXISTS idx_ext_logs_customer ON seguwallet_external_policy_logs(seguwallet_customer_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ext_policy_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ext_policy_updated_at ON seguwallet_external_policies;
CREATE TRIGGER trg_ext_policy_updated_at
  BEFORE UPDATE ON seguwallet_external_policies
  FOR EACH ROW EXECUTE FUNCTION update_ext_policy_updated_at();

-- ─── RLS: seguwallet_external_policies ───────────────────────────────────────

-- Customers can see their own non-deleted policies
CREATE POLICY "Customer sees own ext policies"
  ON seguwallet_external_policies FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

-- Customers can insert their own policies
CREATE POLICY "Customer inserts own ext policies"
  ON seguwallet_external_policies FOR INSERT
  TO authenticated
  WITH CHECK (
    seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

-- Customers can update their own non-deleted policies
CREATE POLICY "Customer updates own ext policies"
  ON seguwallet_external_policies FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

-- Agents can see ext policies for their assigned customers (read-only)
CREATE POLICY "Agent sees customer ext policies"
  ON seguwallet_external_policies FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND agent_user_id = auth.uid()
  );

-- Admins can see all
CREATE POLICY "Admin sees all ext policies"
  ON seguwallet_external_policies FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- ─── RLS: seguwallet_external_policy_documents ───────────────────────────────

CREATE POLICY "Customer sees own ext docs"
  ON seguwallet_external_policy_documents FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Customer inserts own ext docs"
  ON seguwallet_external_policy_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Customer soft deletes own ext docs"
  ON seguwallet_external_policy_documents FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

-- Agents see docs of their customers (via agent_user_id on parent policy)
CREATE POLICY "Agent sees customer ext docs"
  ON seguwallet_external_policy_documents FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND external_policy_id IN (
      SELECT id FROM seguwallet_external_policies
      WHERE agent_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "Admin sees all ext docs"
  ON seguwallet_external_policy_documents FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- ─── RLS: seguwallet_external_policy_logs ────────────────────────────────────

CREATE POLICY "Customer sees own ext logs"
  ON seguwallet_external_policy_logs FOR SELECT
  TO authenticated
  USING (
    seguwallet_customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Authenticated inserts ext logs"
  ON seguwallet_external_policy_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin sees all ext logs"
  ON seguwallet_external_policy_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- ─── Storage bucket ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seguwallet-external-policies',
  'seguwallet-external-policies',
  false,
  52428800,  -- 50 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: customers upload/download their own files
-- Path: seguwallet/{customer_id}/external-policies/{policy_id}/{filename}

CREATE POLICY "Customer upload ext policy files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seguwallet-external-policies'
    AND (storage.foldername(name))[1] = 'seguwallet'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Customer read own ext policy files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'seguwallet-external-policies'
    AND (storage.foldername(name))[1] = 'seguwallet'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Customer delete own ext policy files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'seguwallet-external-policies'
    AND (storage.foldername(name))[1] = 'seguwallet'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM seguwallet_customers
      WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Agent read customer ext policy files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'seguwallet-external-policies'
    AND (storage.foldername(name))[1] = 'seguwallet'
    AND (storage.foldername(name))[2] IN (
      SELECT sc.id::text FROM seguwallet_customers sc
      JOIN seguwallet_external_policies sep ON sep.seguwallet_customer_id = sc.id
      WHERE sep.agent_user_id = auth.uid()
    )
  );
