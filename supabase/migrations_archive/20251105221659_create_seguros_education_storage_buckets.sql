/*
  # Create Seguros Education Storage Buckets
  
  1. Changes
    - Create seguros-videos bucket for lesson videos
    - Create seguros-thumbnails bucket for lesson thumbnails
    - Set up RLS policies for authenticated users
    
  2. Security
    - Videos bucket: Public access for viewing, authenticated for upload
    - Thumbnails bucket: Public access for viewing, authenticated for upload
    - Only authenticated users can upload
    - Everyone can view (public buckets)
*/

-- Create seguros-videos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('seguros-videos', 'seguros-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create seguros-thumbnails bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('seguros-thumbnails', 'seguros-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for seguros-videos bucket
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'seguros-videos');

CREATE POLICY "Authenticated users can update videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'seguros-videos')
WITH CHECK (bucket_id = 'seguros-videos');

CREATE POLICY "Authenticated users can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'seguros-videos');

CREATE POLICY "Anyone can view videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'seguros-videos');

-- Policies for seguros-thumbnails bucket
CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'seguros-thumbnails');

CREATE POLICY "Authenticated users can update thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'seguros-thumbnails')
WITH CHECK (bucket_id = 'seguros-thumbnails');

CREATE POLICY "Authenticated users can delete thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'seguros-thumbnails');

CREATE POLICY "Anyone can view thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'seguros-thumbnails');
