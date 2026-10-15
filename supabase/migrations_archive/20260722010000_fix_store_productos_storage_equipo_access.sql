-- TKF88F0: subir producto nuevo fallaba con "new row violates row-level security
-- policy" al subir la imagen. El bucket de Storage "store-productos" nunca vive
-- en git (se creo directo en el dashboard) y su policy solo dejaba subir a
-- rol = 'Administrador'. La tabla store_productos ya permite tambien a miembros
-- de equipo con acceso al store (store_productos_equipo_crear, 20260703000002)
-- pero ese fix nunca llego al bucket. Estas policies solo AGREGAN el acceso que
-- falta (se combinan con OR con lo que ya exista, no reemplazan nada).

CREATE POLICY "store_productos_storage_admin_o_equipo_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-productos'
    AND (
      EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
      OR EXISTS (
        SELECT 1 FROM tramites_grupos_miembros tgm
        JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
        WHERE tgm.usuario_id = auth.uid()
      )
    )
  );

CREATE POLICY "store_productos_storage_admin_o_equipo_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-productos'
    AND (
      EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
      OR EXISTS (
        SELECT 1 FROM tramites_grupos_miembros tgm
        JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
        WHERE tgm.usuario_id = auth.uid()
      )
    )
  );
