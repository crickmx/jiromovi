-- Las policies de INSERT/UPDATE/DELETE del bucket "manuals" comparaban
-- rol IN ('admin', 'superadmin') — esos valores nunca existen en
-- usuarios.rol (el valor real es 'Administrador'). Esto significa que
-- NADIE ha podido subir/reemplazar/borrar archivos de manuales desde la
-- app desde que se creo el bucket (20260519164511) — cualquier archivo
-- que ya funciona fue subido por fuera (SQL editor / service role).

DROP POLICY IF EXISTS "Admins can upload manual files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update manual files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete manual files" ON storage.objects;

CREATE POLICY "Admins can upload manual files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'manuals'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can update manual files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'manuals'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
    )
  )
  WITH CHECK (
    bucket_id = 'manuals'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
    )
  );

CREATE POLICY "Admins can delete manual files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'manuals'
    AND EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol = 'Administrador'
    )
  );
