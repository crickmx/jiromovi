-- Bucket para recursos de marca Jiro (logos, plantillas, guías, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recursos-marca',
  'recursos-marca',
  false,
  52428800, -- 50 MB
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf','application/zip','application/x-zip-compressed','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Todos los usuarios autenticados pueden leer
CREATE POLICY IF NOT EXISTS "Usuarios autenticados pueden leer recursos de marca"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recursos-marca' AND auth.role() = 'authenticated');

-- Solo admins pueden subir
CREATE POLICY IF NOT EXISTS "Admins pueden subir recursos de marca"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recursos-marca' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

-- Solo admins pueden eliminar
CREATE POLICY IF NOT EXISTS "Admins pueden eliminar recursos de marca"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'recursos-marca' AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );
