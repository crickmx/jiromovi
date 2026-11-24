/*
  # Create storage bucket for manual files

  1. Storage
    - Creates `manuals` storage bucket for HTML files and cover images
    - Public access for reading (manuals are viewable by authenticated users)
    - File size limit: 100MB (HTML files with embedded assets can be large)
    - Allowed MIME types: text/html, image/png, image/jpeg, image/webp, image/gif, application/octet-stream

  2. Security
    - Public SELECT for anyone (manuals content is readable)
    - INSERT/UPDATE/DELETE restricted to admin role users
*/

-- Create the manuals storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'manuals',
  'manuals',
  true,
  104857600,
  ARRAY['text/html', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['text/html', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/octet-stream'];

-- Public read access
CREATE POLICY "Anyone can read manual files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'manuals');

-- Admin insert
CREATE POLICY "Admins can upload manual files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'manuals'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol IN ('admin', 'superadmin')
    )
  );

-- Admin update
CREATE POLICY "Admins can update manual files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'manuals'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    bucket_id = 'manuals'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol IN ('admin', 'superadmin')
    )
  );

-- Admin delete
CREATE POLICY "Admins can delete manual files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'manuals'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol IN ('admin', 'superadmin')
    )
  );
