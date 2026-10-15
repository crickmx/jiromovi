-- Fix: bucket store-productos existía pero sin políticas de Storage.
-- La tabla store_productos ya tiene RLS por equipo (20260703000002),
-- pero el Storage es independiente y necesita sus propias políticas.

-- Asegurar que el bucket exista (por si no se creó por migración)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-productos',
  'store-productos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (coincide con getPublicUrl que ya funciona)
CREATE POLICY "store_productos_storage_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-productos');

-- Upload: Admin o miembro de equipo con acceso a Store
CREATE POLICY "store_productos_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-productos'
  AND (
    get_my_rol() = ANY (ARRAY['Administrador', 'Gerente'])
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
);

-- Update (reemplazar imagen)
CREATE POLICY "store_productos_storage_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-productos'
  AND (
    get_my_rol() = ANY (ARRAY['Administrador', 'Gerente'])
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
);

-- Delete
CREATE POLICY "store_productos_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-productos'
  AND (
    get_my_rol() = ANY (ARRAY['Administrador', 'Gerente'])
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
);
