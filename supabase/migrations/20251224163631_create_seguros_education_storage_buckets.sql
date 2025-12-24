/*
  # Crear buckets de Storage para Seguros Education

  1. Nuevos Buckets
    - videos-seguros-education: Almacena videos de capacitación
    - thumbnails-seguros-education: Almacena thumbnails/miniaturas
    - videos-migration-temp: Bucket temporal para migración

  2. Configuración
    - Públicos para acceso anónimo
    - Límites de tamaño apropiados
    - Tipos de archivo permitidos

  3. Seguridad
    - Lectura pública (anónima)
    - Escritura solo para usuarios autenticados
    - Eliminación solo para administradores
*/

-- Crear bucket para videos (hasta 10GB por archivo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos-seguros-education',
  'videos-seguros-education',
  true,
  10737418240, -- 10GB
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10737418240,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/webm']::text[];

-- Crear bucket para thumbnails (hasta 500MB por archivo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails-seguros-education',
  'thumbnails-seguros-education',
  true,
  524288000, -- 500MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[];

-- Crear bucket temporal para migración
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'videos-migration-temp',
  'videos-migration-temp',
  false,
  10737418240 -- 10GB
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10737418240;

-- Políticas para videos-seguros-education
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete videos" ON storage.objects;

CREATE POLICY "Public can view videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos-seguros-education');

CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos-seguros-education');

CREATE POLICY "Authenticated users can update videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'videos-seguros-education')
WITH CHECK (bucket_id = 'videos-seguros-education');

CREATE POLICY "Admins can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos-seguros-education'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- Políticas para thumbnails-seguros-education
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete thumbnails" ON storage.objects;

CREATE POLICY "Public can view thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails-seguros-education');

CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails-seguros-education');

CREATE POLICY "Authenticated users can update thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails-seguros-education')
WITH CHECK (bucket_id = 'thumbnails-seguros-education');

CREATE POLICY "Admins can delete thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'thumbnails-seguros-education'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);

-- Políticas para videos-migration-temp (solo admins)
DROP POLICY IF EXISTS "Admins can manage migration temp" ON storage.objects;

CREATE POLICY "Admins can manage migration temp"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'videos-migration-temp'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'videos-migration-temp'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
  )
);
