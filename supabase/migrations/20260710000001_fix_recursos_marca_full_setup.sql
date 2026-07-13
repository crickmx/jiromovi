-- Asegura que el bucket recursos-marca exista con todos los MIME types necesarios
-- (logos, iconos, fuentes TTF/OTF, paleta, PDFs, ZIPs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recursos-marca',
  'recursos-marca',
  false,
  52428800, -- 50 MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit    = EXCLUDED.file_size_limit;

-- Asegura que el bucket fotos-estudio exista
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-estudio',
  'fotos-estudio',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── Políticas recursos-marca ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Usuarios autenticados pueden leer recursos de marca" ON storage.objects;
DROP POLICY IF EXISTS "Admins pueden subir recursos de marca"               ON storage.objects;
DROP POLICY IF EXISTS "Admins pueden eliminar recursos de marca"            ON storage.objects;
DROP POLICY IF EXISTS "Admins pueden actualizar recursos de marca"          ON storage.objects;

CREATE POLICY "rm_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recursos-marca');

CREATE POLICY "rm_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recursos-marca' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "rm_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'recursos-marca' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "rm_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'recursos-marca' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

-- ── Políticas fotos-estudio ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "fotos_estudio_user_select"  ON storage.objects;
DROP POLICY IF EXISTS "fotos_estudio_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "fotos_estudio_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "fotos_estudio_admin_delete" ON storage.objects;

CREATE POLICY "fe_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos-estudio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "fe_select_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos-estudio' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "fe_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-estudio' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "fe_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-estudio' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );
