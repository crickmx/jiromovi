/*
  # Create Admin Digital (Clara) Module

  1. New Tables
    - `clara_cost_centers` - Cost center categories for expense classification
      - `id` (uuid, primary key)
      - `name` (text, unique) - Name of the cost center
      - `created_at` (timestamptz)
    - `clara_simple_concepts` - Simple concept categories for expense type
      - `id` (uuid, primary key)
      - `name` (text, unique) - Name of the concept
      - `created_at` (timestamptz)
    - `clara_vendor_mappings` - Learned vendor-to-category mappings for auto-classification
      - `id` (uuid, primary key)
      - `normalized_vendor` (text, unique) - Normalized vendor name
      - `cost_center` (text) - Assigned cost center
      - `simple_concept` (text) - Assigned concept
      - `description` (text) - Additional details
      - `usage_count` (integer) - Times this mapping was used
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `clara_periods` - Loaded expense periods (monthly or custom)
      - `id` (uuid, primary key)
      - `period_key` (text, unique) - Unique period identifier (YYYY-MM or range)
      - `label` (text) - Human-readable period label
      - `date_from` (text) - Start date
      - `date_to` (text) - End date
      - `file_name` (text) - Source file name
      - `transaction_count` (integer) - Number of transactions in period
      - `total_amount_mxn` (numeric) - Total amount in MXN
      - `created_at` (timestamptz)
    - `clara_transactions` - Individual expense transactions
      - `id` (uuid, primary key)
      - `transaction_date` (text) - Transaction date
      - `original_vendor` (text) - Original vendor name from CSV
      - `normalized_vendor` (text) - Cleaned/normalized vendor name
      - `amount_mxn` (numeric) - Amount in MXN
      - `cost_center` (text) - Assigned cost center
      - `simple_concept` (text) - Assigned concept
      - `description` (text) - Additional details
      - `card_alias` (text) - Card alias/identifier
      - `auth_code` (text) - Authorization code
      - `match_type` (text) - How vendor was matched
      - `batch_id` (text) - Import batch identifier
      - `period_id` (uuid) - Reference to period
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Only authenticated administrators can read/write data

  3. Important Notes
    - This module is exclusively for administrators
    - Deduplication handled via unique constraint on transactions
    - Vendor mappings learn from user classifications for auto-assignment
*/

-- Clara Cost Centers
CREATE TABLE IF NOT EXISTS clara_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clara_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select clara_cost_centers"
  ON clara_cost_centers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert clara_cost_centers"
  ON clara_cost_centers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can update clara_cost_centers"
  ON clara_cost_centers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete clara_cost_centers"
  ON clara_cost_centers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

-- Clara Simple Concepts
CREATE TABLE IF NOT EXISTS clara_simple_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clara_simple_concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select clara_simple_concepts"
  ON clara_simple_concepts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert clara_simple_concepts"
  ON clara_simple_concepts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can update clara_simple_concepts"
  ON clara_simple_concepts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete clara_simple_concepts"
  ON clara_simple_concepts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

-- Clara Vendor Mappings
CREATE TABLE IF NOT EXISTS clara_vendor_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_vendor text UNIQUE NOT NULL,
  cost_center text NOT NULL DEFAULT '',
  simple_concept text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  usage_count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clara_vendor_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select clara_vendor_mappings"
  ON clara_vendor_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert clara_vendor_mappings"
  ON clara_vendor_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can update clara_vendor_mappings"
  ON clara_vendor_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete clara_vendor_mappings"
  ON clara_vendor_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

-- Clara Periods
CREATE TABLE IF NOT EXISTS clara_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT '',
  date_from text NOT NULL DEFAULT '',
  date_to text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  transaction_count integer NOT NULL DEFAULT 0,
  total_amount_mxn numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clara_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select clara_periods"
  ON clara_periods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert clara_periods"
  ON clara_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can update clara_periods"
  ON clara_periods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete clara_periods"
  ON clara_periods FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

-- Clara Transactions
CREATE TABLE IF NOT EXISTS clara_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date text NOT NULL DEFAULT '',
  original_vendor text NOT NULL DEFAULT '',
  normalized_vendor text NOT NULL DEFAULT '',
  amount_mxn numeric NOT NULL DEFAULT 0,
  cost_center text NOT NULL DEFAULT '',
  simple_concept text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  card_alias text NOT NULL DEFAULT '',
  auth_code text NOT NULL DEFAULT '',
  match_type text NOT NULL DEFAULT '',
  batch_id text NOT NULL DEFAULT '',
  period_id uuid REFERENCES clara_periods(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(auth_code, transaction_date, amount_mxn, normalized_vendor)
);

ALTER TABLE clara_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select clara_transactions"
  ON clara_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert clara_transactions"
  ON clara_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can update clara_transactions"
  ON clara_transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete clara_transactions"
  ON clara_transactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'administrador', 'Admin', 'admin')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clara_transactions_period_id ON clara_transactions(period_id);
CREATE INDEX IF NOT EXISTS idx_clara_transactions_transaction_date ON clara_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_clara_transactions_batch_id ON clara_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_clara_vendor_mappings_normalized ON clara_vendor_mappings(normalized_vendor);
