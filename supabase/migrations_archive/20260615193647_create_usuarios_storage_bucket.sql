-- Create the 'usuarios' storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'usuarios',
  'usuarios',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "users_upload_own_avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'usuarios'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow authenticated users to update their own avatar
CREATE POLICY "users_update_own_avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = 'avatars')
WITH CHECK (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = 'avatars');

-- Allow public read access to avatars
CREATE POLICY "public_read_avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'usuarios');

-- Allow authenticated users to delete their own avatar
CREATE POLICY "users_delete_own_avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'usuarios' AND (storage.foldername(name))[1] = 'avatars');
