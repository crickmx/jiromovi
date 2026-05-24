/*
  # Create Seguwallet Module

  1. New Tables
    - `seguwallet_customers` - Independent client users for the Seguwallet portal
      - `id` (uuid, primary key)
      - `auth_user_id` (uuid, links to auth.users for independent login)
      - `agent_user_id` (uuid, references the MOVI agent/admin who owns this client)
      - `email` (text, unique, login credential)
      - `full_name` (text)
      - `phone` (text)
      - `status` (text: active, inactive, blocked)
      - `created_by` (uuid, MOVI user who created this record)
      - `created_by_role` (text)
      - `last_login_at` (timestamptz)
      - `password_updated_at` (timestamptz)
      - `created_at` / `updated_at` (timestamptz)

    - `seguwallet_customer_sicas_clients` - Pivot table linking Seguwallet customers to SICAS clients
      - `id` (uuid, primary key)
      - `seguwallet_customer_id` (uuid, FK)
      - `sicas_client_id` (text)
      - `sicas_client_name` (text)
      - `sicas_client_rfc` (text)
      - `created_at` (timestamptz)
      - `created_by` (uuid)

    - `seguwallet_access_logs` - Login/access audit trail
      - `id` (uuid, primary key)
      - `seguwallet_customer_id` (uuid, FK)
      - `event_type` (text: login_success, login_failed, logout, password_reset, etc.)
      - `ip_address` (text)
      - `user_agent` (text)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)

    - `seguwallet_download_logs` - Document download audit
      - `id` (uuid, primary key)
      - `seguwallet_customer_id` (uuid, FK)
      - `document_id` (text)
      - `document_type` (text)
      - `document_name` (text)
      - `policy_number` (text)
      - `downloaded_at` (timestamptz)
      - `metadata` (jsonb)

    - `seguwallet_admin_preview_logs` - Logs when Admin/Agent previews a client
      - `id` (uuid, primary key)
      - `admin_user_id` (uuid)
      - `seguwallet_customer_id` (uuid)
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Seguwallet customers can only see their own data
    - MOVI Agents can only manage their own clients
    - MOVI Admins have full access
    - Service role bypass for edge functions

  3. Important Notes
    - No existing tables are modified destructively
    - Independent auth flow for Seguwallet clients
    - Seguwallet users use a separate role marker in auth metadata
*/

-- 1. Main customers table
CREATE TABLE IF NOT EXISTS seguwallet_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  agent_user_id uuid NOT NULL,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_by_role text,
  last_login_at timestamptz,
  password_updated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT seguwallet_customers_status_check CHECK (status IN ('active', 'inactive', 'blocked'))
);

-- 2. Pivot: customer <-> SICAS clients
CREATE TABLE IF NOT EXISTS seguwallet_customer_sicas_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguwallet_customer_id uuid NOT NULL REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  sicas_client_id text NOT NULL,
  sicas_client_name text DEFAULT '',
  sicas_client_rfc text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  created_by uuid,

  CONSTRAINT seguwallet_sicas_unique UNIQUE (seguwallet_customer_id, sicas_client_id)
);

-- 3. Access/login logs
CREATE TABLE IF NOT EXISTS seguwallet_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguwallet_customer_id uuid NOT NULL REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  ip_address text DEFAULT '',
  user_agent text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 4. Download logs
CREATE TABLE IF NOT EXISTS seguwallet_download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguwallet_customer_id uuid NOT NULL REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  document_id text DEFAULT '',
  document_type text DEFAULT '',
  document_name text DEFAULT '',
  policy_number text DEFAULT '',
  downloaded_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- 5. Admin preview logs
CREATE TABLE IF NOT EXISTS seguwallet_admin_preview_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  seguwallet_customer_id uuid NOT NULL REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seguwallet_customers_agent ON seguwallet_customers(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_seguwallet_customers_auth ON seguwallet_customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_seguwallet_customers_status ON seguwallet_customers(status);
CREATE INDEX IF NOT EXISTS idx_seguwallet_customers_email ON seguwallet_customers(email);
CREATE INDEX IF NOT EXISTS idx_seguwallet_sicas_customer ON seguwallet_customer_sicas_clients(seguwallet_customer_id);
CREATE INDEX IF NOT EXISTS idx_seguwallet_sicas_client_id ON seguwallet_customer_sicas_clients(sicas_client_id);
CREATE INDEX IF NOT EXISTS idx_seguwallet_access_customer ON seguwallet_access_logs(seguwallet_customer_id);
CREATE INDEX IF NOT EXISTS idx_seguwallet_access_created ON seguwallet_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_seguwallet_download_customer ON seguwallet_download_logs(seguwallet_customer_id);
CREATE INDEX IF NOT EXISTS idx_seguwallet_download_date ON seguwallet_download_logs(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_seguwallet_preview_admin ON seguwallet_admin_preview_logs(admin_user_id);

-- Enable RLS on all tables
ALTER TABLE seguwallet_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguwallet_customer_sicas_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguwallet_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguwallet_download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguwallet_admin_preview_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get MOVI user role without recursion
CREATE OR REPLACE FUNCTION get_movi_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM usuarios WHERE id = p_user_id LIMIT 1;
$$;

-- Helper to check if a user is a Seguwallet customer
CREATE OR REPLACE FUNCTION is_seguwallet_customer(p_auth_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM seguwallet_customers WHERE auth_user_id = p_auth_id
  );
$$;

-- Helper to get seguwallet_customer_id from auth id
CREATE OR REPLACE FUNCTION get_seguwallet_customer_id(p_auth_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM seguwallet_customers WHERE auth_user_id = p_auth_id LIMIT 1;
$$;

-- ==========================================
-- RLS POLICIES: seguwallet_customers
-- ==========================================

-- Seguwallet customer can read own record
CREATE POLICY "seguwallet_customer_read_own"
  ON seguwallet_customers
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR
    (get_movi_user_role(auth.uid()) = 'Administrador')
    OR
    (get_movi_user_role(auth.uid()) IN ('Gerente', 'Agente', 'Empleado', 'Ejecutivo') AND agent_user_id = auth.uid())
  );

-- Admin can insert
CREATE POLICY "seguwallet_customer_insert_admin_agent"
  ON seguwallet_customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    (get_movi_user_role(auth.uid()) IN ('Agente', 'Gerente', 'Ejecutivo') AND agent_user_id = auth.uid())
  );

-- Admin can update any; Agent can update own clients
CREATE POLICY "seguwallet_customer_update"
  ON seguwallet_customers
  FOR UPDATE
  TO authenticated
  USING (
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    (get_movi_user_role(auth.uid()) IN ('Agente', 'Gerente', 'Ejecutivo') AND agent_user_id = auth.uid())
  )
  WITH CHECK (
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    (get_movi_user_role(auth.uid()) IN ('Agente', 'Gerente', 'Ejecutivo') AND agent_user_id = auth.uid())
  );

-- Admin can delete
CREATE POLICY "seguwallet_customer_delete_admin"
  ON seguwallet_customers
  FOR DELETE
  TO authenticated
  USING (
    get_movi_user_role(auth.uid()) = 'Administrador'
  );

-- ==========================================
-- RLS POLICIES: seguwallet_customer_sicas_clients
-- ==========================================

-- Seguwallet customer can read own SICAS assignments
CREATE POLICY "seguwallet_sicas_read"
  ON seguwallet_customer_sicas_clients
  FOR SELECT
  TO authenticated
  USING (
    seguwallet_customer_id = get_seguwallet_customer_id(auth.uid())
    OR
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_id AND sc.agent_user_id = auth.uid()
    )
  );

-- Admin/Agent can insert
CREATE POLICY "seguwallet_sicas_insert"
  ON seguwallet_customer_sicas_clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_id AND sc.agent_user_id = auth.uid()
    )
  );

-- Admin/Agent can delete
CREATE POLICY "seguwallet_sicas_delete"
  ON seguwallet_customer_sicas_clients
  FOR DELETE
  TO authenticated
  USING (
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_id AND sc.agent_user_id = auth.uid()
    )
  );

-- ==========================================
-- RLS POLICIES: seguwallet_access_logs
-- ==========================================

-- Customer can read own logs; Admin/Agent can read their clients' logs
CREATE POLICY "seguwallet_access_logs_read"
  ON seguwallet_access_logs
  FOR SELECT
  TO authenticated
  USING (
    seguwallet_customer_id = get_seguwallet_customer_id(auth.uid())
    OR
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_id AND sc.agent_user_id = auth.uid()
    )
  );

-- Insert for service role and authenticated (for login tracking)
CREATE POLICY "seguwallet_access_logs_insert"
  ON seguwallet_access_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ==========================================
-- RLS POLICIES: seguwallet_download_logs
-- ==========================================

CREATE POLICY "seguwallet_download_logs_read"
  ON seguwallet_download_logs
  FOR SELECT
  TO authenticated
  USING (
    seguwallet_customer_id = get_seguwallet_customer_id(auth.uid())
    OR
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_customer_id AND sc.agent_user_id = auth.uid()
    )
  );

CREATE POLICY "seguwallet_download_logs_insert"
  ON seguwallet_download_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    seguwallet_customer_id = get_seguwallet_customer_id(auth.uid())
    OR
    get_movi_user_role(auth.uid()) = 'Administrador'
  );

-- ==========================================
-- RLS POLICIES: seguwallet_admin_preview_logs
-- ==========================================

CREATE POLICY "seguwallet_preview_logs_read"
  ON seguwallet_admin_preview_logs
  FOR SELECT
  TO authenticated
  USING (
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    admin_user_id = auth.uid()
  );

CREATE POLICY "seguwallet_preview_logs_insert"
  ON seguwallet_admin_preview_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_movi_user_role(auth.uid()) = 'Administrador'
    OR
    get_movi_user_role(auth.uid()) IN ('Agente', 'Gerente', 'Ejecutivo')
  );

CREATE POLICY "seguwallet_preview_logs_update"
  ON seguwallet_admin_preview_logs
  FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

-- Updated_at trigger for seguwallet_customers
CREATE OR REPLACE FUNCTION update_seguwallet_customers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_seguwallet_customers_updated_at ON seguwallet_customers;
CREATE TRIGGER tr_seguwallet_customers_updated_at
  BEFORE UPDATE ON seguwallet_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_seguwallet_customers_updated_at();
