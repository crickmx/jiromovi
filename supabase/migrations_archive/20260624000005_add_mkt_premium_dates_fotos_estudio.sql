-- Add marketing premium date fields to usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_fecha_inicio date,
  ADD COLUMN IF NOT EXISTS mkt_premium_fecha_pago date;

-- Create fotos-estudio storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-estudio',
  'fotos-estudio',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Users can view files in their own folder
CREATE POLICY "fotos_estudio_user_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fotos-estudio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can view all folders
CREATE POLICY "fotos_estudio_admin_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'fotos-estudio'
  AND EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'
  )
);

-- Admins can upload to any folder
CREATE POLICY "fotos_estudio_admin_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'fotos-estudio'
  AND EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'
  )
);

-- Admins can delete from any folder
CREATE POLICY "fotos_estudio_admin_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'fotos-estudio'
  AND EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'
  )
);
