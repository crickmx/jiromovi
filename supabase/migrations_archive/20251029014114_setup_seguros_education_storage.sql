/*
  # Setup Supabase Storage for Seguros Education

  ## Overview
  Creates storage buckets and policies for:
  - Video lessons
  - Thumbnails/miniatures
  - Session recordings

  ## Storage Buckets
    - `seguros-videos` - For lesson videos and recordings
    - `seguros-thumbnails` - For lesson thumbnail images

  ## Security
    - Public read access for all authenticated users
    - Only Administradores can upload/delete files
    - File size limits and type restrictions

  ## Notes
    - Videos should be uploaded in MP4, WebM, or MOV format
    - Thumbnails should be JPG, PNG, or WebP
    - Maximum file size managed by Supabase (default 50MB)
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('seguros-videos', 'seguros-videos', true, 524288000, ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']::text[]),
  ('seguros-thumbnails', 'seguros-thumbnails', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for seguros-videos bucket

-- Allow authenticated users to read videos
CREATE POLICY "Authenticated users can view videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'seguros-videos');

-- Allow admins to upload videos
CREATE POLICY "Admins can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seguros-videos'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'Administrador'
    AND usuarios.activo = true
  )
);

-- Allow admins to update videos
CREATE POLICY "Admins can update videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'seguros-videos'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'Administrador'
    AND usuarios.activo = true
  )
);

-- Allow admins to delete videos
CREATE POLICY "Admins can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'seguros-videos'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'Administrador'
    AND usuarios.activo = true
  )
);

-- Storage policies for seguros-thumbnails bucket

-- Allow authenticated users to read thumbnails
CREATE POLICY "Authenticated users can view thumbnails"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'seguros-thumbnails');

-- Allow admins to upload thumbnails
CREATE POLICY "Admins can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seguros-thumbnails'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'Administrador'
    AND usuarios.activo = true
  )
);

-- Allow admins to update thumbnails
CREATE POLICY "Admins can update thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'seguros-thumbnails'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'Administrador'
    AND usuarios.activo = true
  )
);

-- Allow admins to delete thumbnails
CREATE POLICY "Admins can delete thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'seguros-thumbnails'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'Administrador'
    AND usuarios.activo = true
  )
);
