/*
  # Add local logo storage for SeguWallet insurers

  1. Changes to seguwallet_insurers
     - `logo_local_path` (text, nullable): Supabase Storage path within insurance-carriers-logos bucket
     - `logo_original_source_url` (text, nullable): Original external URL used as import source reference

  2. Storage bucket `insurance-carriers-logos` (public)
     - 5MB limit, common image MIME types
     - Public SELECT for all
     - Authenticated admin/gerente/ejecutivo can INSERT/UPDATE/DELETE
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seguwallet_insurers' AND column_name = 'logo_local_path'
  ) THEN
    ALTER TABLE seguwallet_insurers ADD COLUMN logo_local_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seguwallet_insurers' AND column_name = 'logo_original_source_url'
  ) THEN
    ALTER TABLE seguwallet_insurers ADD COLUMN logo_original_source_url text;
  END IF;
END $$;

-- Create storage bucket for insurance carrier logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurance-carriers-logos',
  'insurance-carriers-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];

-- Public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Insurance logos are publicly accessible'
  ) THEN
    CREATE POLICY "Insurance logos are publicly accessible"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'insurance-carriers-logos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Admins can upload insurance logos'
  ) THEN
    CREATE POLICY "Admins can upload insurance logos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'insurance-carriers-logos'
        AND EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('admin', 'gerente', 'ejecutivo')
          AND usuarios.activo = true
          AND usuarios.deleted_at IS NULL
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Admins can update insurance logos'
  ) THEN
    CREATE POLICY "Admins can update insurance logos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'insurance-carriers-logos'
        AND EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('admin', 'gerente', 'ejecutivo')
          AND usuarios.activo = true
          AND usuarios.deleted_at IS NULL
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Admins can delete insurance logos'
  ) THEN
    CREATE POLICY "Admins can delete insurance logos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'insurance-carriers-logos'
        AND EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('admin', 'gerente', 'ejecutivo')
          AND usuarios.activo = true
          AND usuarios.deleted_at IS NULL
        )
      );
  END IF;
END $$;
