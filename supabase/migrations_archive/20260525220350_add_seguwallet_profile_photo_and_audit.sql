/*
  # SeguWallet Profile Photo & Audit Log

  1. Changes
    - Adds profile_photo_url, profile_photo_path, whatsapp, profile_updated_at to seguwallet_customers
    - Creates seguwallet_profile_photos storage bucket (public, 5MB)
    - Creates seguwallet_profile_audit_logs table for tracking profile edits
    - RLS policies: customer can update own photo/profile, agent can update their customers, admin all

  2. Storage
    - Bucket: seguwallet-profile-photos (public)
    - Path: seguwallet/customers/{customer_id}/profile-photo.{ext}

  3. Audit Log Fields
    - actor_id, actor_type (customer/agent/admin), customer_id, action, changed_fields, created_at
*/

-- Add new columns if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'profile_photo_url') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN profile_photo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'profile_photo_path') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN profile_photo_path text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'whatsapp') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN whatsapp text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'profile_updated_at') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN profile_updated_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seguwallet_customers' AND column_name = 'deleted_at') THEN
    ALTER TABLE seguwallet_customers ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Create audit log table
CREATE TABLE IF NOT EXISTS seguwallet_profile_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('customer', 'agent', 'admin')),
  action text NOT NULL,
  changed_fields jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE seguwallet_profile_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view audit logs of their customers"
  ON seguwallet_profile_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM seguwallet_customers sc
      WHERE sc.id = seguwallet_profile_audit_logs.customer_id
        AND sc.agent_user_id = auth.uid()
        AND sc.deleted_at IS NULL
    )
  );

CREATE POLICY "Admins can view all audit logs"
  ON seguwallet_profile_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Administrador'
        AND u.activo = true
    )
  );

CREATE POLICY "Service role can insert audit logs"
  ON seguwallet_profile_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'seguwallet-profile-photos',
  'seguwallet-profile-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Storage policies: public read
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public read seguwallet profile photos" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public read seguwallet profile photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'seguwallet-profile-photos');

-- Customer can upload their own photo (auth_user_id maps via seguwallet_customers)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Seguwallet customers upload own photo" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Seguwallet customers upload own photo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seguwallet-profile-photos'
    AND (
      EXISTS (
        SELECT 1 FROM seguwallet_customers sc
        WHERE sc.auth_user_id = auth.uid()
          AND name LIKE 'seguwallet/customers/' || sc.id::text || '/%'
      )
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid() AND u.activo = true
          AND u.rol IN ('Administrador', 'Agente', 'Gerente', 'Ejecutivo')
      )
    )
  );

DO $$
BEGIN
  DROP POLICY IF EXISTS "Seguwallet customers update own photo" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Seguwallet customers update own photo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'seguwallet-profile-photos'
    AND (
      EXISTS (
        SELECT 1 FROM seguwallet_customers sc
        WHERE sc.auth_user_id = auth.uid()
          AND name LIKE 'seguwallet/customers/' || sc.id::text || '/%'
      )
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid() AND u.activo = true
          AND u.rol IN ('Administrador', 'Agente', 'Gerente', 'Ejecutivo')
      )
    )
  );

DO $$
BEGIN
  DROP POLICY IF EXISTS "Seguwallet customers delete own photo" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Seguwallet customers delete own photo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'seguwallet-profile-photos'
    AND (
      EXISTS (
        SELECT 1 FROM seguwallet_customers sc
        WHERE sc.auth_user_id = auth.uid()
          AND name LIKE 'seguwallet/customers/' || sc.id::text || '/%'
      )
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid() AND u.activo = true
          AND u.rol IN ('Administrador', 'Agente', 'Gerente', 'Ejecutivo')
      )
    )
  );

-- RLS policy: customer can update their own non-admin fields
DO $$
BEGIN
  DROP POLICY IF EXISTS "Seguwallet customer can update own profile fields" ON seguwallet_customers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Seguwallet customer can update own profile fields"
  ON seguwallet_customers FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Agent can update customers they own
DO $$
BEGIN
  DROP POLICY IF EXISTS "Agent can update own seguwallet customers" ON seguwallet_customers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agent can update own seguwallet customers"
  ON seguwallet_customers FOR UPDATE
  TO authenticated
  USING (
    agent_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.activo = true
        AND u.rol IN ('Agente', 'Gerente', 'Ejecutivo')
    )
  )
  WITH CHECK (
    agent_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.activo = true
        AND u.rol IN ('Agente', 'Gerente', 'Ejecutivo')
    )
  );
