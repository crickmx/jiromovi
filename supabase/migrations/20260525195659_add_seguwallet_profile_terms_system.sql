/*
  # Seguwallet Profile Completion & Terms System

  ## Summary
  Extends the seguwallet customer system with:

  1. New columns on `seguwallet_customers`:
     - state, municipality: location info collected at first login
     - birth_date, gender: demographic info
     - profile_completed / profile_completed_at: tracks mandatory first-login form
     - terms_accepted / terms_accepted_at: tracks current terms acceptance
     - terms_version_accepted: text version tag of accepted terms
     - terms_id_accepted: FK to seguwallet_terms record accepted

  2. New table `seguwallet_terms`:
     - Versioned terms & conditions documents
     - Only one active version at a time (enforced by trigger)

  3. Event log table `seguwallet_customer_events`:
     - Tracks: profile_completed, terms_accepted, terms_reaccepted, terms_version_published, login

  4. RLS + helper function get_active_seguwallet_terms()
*/

-- ============================================================
-- 1. Add new columns to seguwallet_customers
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'state') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN state text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'municipality') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN municipality text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'birth_date') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN birth_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'gender') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN gender text CHECK (gender IN ('masculino', 'femenino', 'no_binario', 'prefiero_no_decir'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'profile_completed') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN profile_completed boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'profile_completed_at') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN profile_completed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'terms_accepted') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN terms_accepted boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'terms_accepted_at') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN terms_accepted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'terms_version_accepted') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN terms_version_accepted text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'terms_id_accepted') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN terms_id_accepted uuid;
  END IF;
END $$;

-- ============================================================
-- 2. Create seguwallet_terms table
-- ============================================================
CREATE TABLE IF NOT EXISTS seguwallet_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Términos y Condiciones',
  content text NOT NULL,
  version text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE seguwallet_terms ENABLE ROW LEVEL SECURITY;

-- Only one active terms at a time
CREATE OR REPLACE FUNCTION enforce_single_active_terms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE seguwallet_terms SET is_active = false WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_active_terms ON seguwallet_terms;
CREATE TRIGGER trg_single_active_terms
  BEFORE INSERT OR UPDATE ON seguwallet_terms
  FOR EACH ROW EXECUTE FUNCTION enforce_single_active_terms();

-- FK from seguwallet_customers to seguwallet_terms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'seguwallet_customers_terms_id_accepted_fkey'
  ) THEN
    ALTER TABLE seguwallet_customers
      ADD CONSTRAINT seguwallet_customers_terms_id_accepted_fkey
      FOREIGN KEY (terms_id_accepted) REFERENCES seguwallet_terms(id);
  END IF;
END $$;

-- ============================================================
-- 3. Create customer event log
-- ============================================================
CREATE TABLE IF NOT EXISTS seguwallet_customer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'profile_completed', 'terms_accepted', 'terms_reaccepted', 'terms_version_published', 'login'
  )),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE seguwallet_customer_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies
-- ============================================================

-- seguwallet_terms: admins full access (usuarios.id = auth.uid() for admin roles)
CREATE POLICY "Admins can manage terms"
  ON seguwallet_terms FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado != 'eliminado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado != 'eliminado')
    )
  );

CREATE POLICY "Authenticated users can read active terms"
  ON seguwallet_terms FOR SELECT
  TO authenticated
  USING (is_active = true);

-- seguwallet_customer_events: customers see/insert own, admins see all
CREATE POLICY "Customers can view own events"
  ON seguwallet_customer_events FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM seguwallet_customers WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can insert own events"
  ON seguwallet_customer_events FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (
      SELECT id FROM seguwallet_customers WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all events"
  ON seguwallet_customer_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.rol IN ('admin', 'superadmin')
        AND (u.estado IS NULL OR u.estado != 'eliminado')
    )
  );

-- seguwallet_customers: allow customer to update own profile fields
CREATE POLICY "Customers can update own profile"
  ON seguwallet_customers FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ============================================================
-- 5. Helper function: get active terms
-- ============================================================
CREATE OR REPLACE FUNCTION get_active_seguwallet_terms()
RETURNS TABLE(id uuid, title text, version text, content text, published_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, version, content, published_at
  FROM seguwallet_terms
  WHERE is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_active_seguwallet_terms() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_seguwallet_terms() TO anon;

-- ============================================================
-- 6. updated_at trigger for seguwallet_terms
-- ============================================================
CREATE OR REPLACE FUNCTION update_seguwallet_terms_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seguwallet_terms_updated_at ON seguwallet_terms;
CREATE TRIGGER trg_seguwallet_terms_updated_at
  BEFORE UPDATE ON seguwallet_terms
  FOR EACH ROW EXECUTE FUNCTION update_seguwallet_terms_updated_at();
