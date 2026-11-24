/*
  # Crear Buckets para Migración de Videos

  1. Buckets
    - `videos-seguros-education`: Videos de lecciones (hasta 10GB)
    - `thumbnails-seguros-education`: Miniaturas de videos (hasta 500MB)

  2. Configuración
    - Ambos buckets son públicos para acceso directo
    - Tamaños de archivo adecuados para videos grandes
    - Políticas de acceso público para lectura
*/

-- Crear bucket para videos con límite de 10GB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos-seguros-education',
  'videos-seguros-education',
  true,
  10737418240, -- 10GB
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10737418240,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/ogg', 'video/x-matroska'];

-- Crear bucket para miniaturas con límite de 500MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails-seguros-education',
  'thumbnails-seguros-education',
  true,
  524288000, -- 500MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Eliminar políticas existentes si existen
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update videos" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete videos" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update thumbnails" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete thumbnails" ON storage.objects;
END $$;

-- Política de lectura pública para videos
CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos-seguros-education');

-- Política de escritura para usuarios autenticados
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos-seguros-education');

-- Política de actualización para usuarios autenticados
CREATE POLICY "Authenticated users can update videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'videos-seguros-education')
WITH CHECK (bucket_id = 'videos-seguros-education');

-- Política de eliminación para administradores
CREATE POLICY "Admins can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos-seguros-education' AND
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- Política de lectura pública para miniaturas
CREATE POLICY "Public can view thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails-seguros-education');

-- Política de escritura para usuarios autenticados
CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails-seguros-education');

-- Política de actualización para usuarios autenticados
CREATE POLICY "Authenticated users can update thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails-seguros-education')
WITH CHECK (bucket_id = 'thumbnails-seguros-education');

-- Política de eliminación para administradores
CREATE POLICY "Admins can delete thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'thumbnails-seguros-education' AND
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);
