-- TK3BD28: subir foto de estudio de un agente desde /mercadotecnia/admin
-- (pestana Fotos de Estudio) no se subia para equipos de Marketing con
-- acceso (mkt_equipos_acceso) — el bucket fotos-estudio solo permitia
-- Administrador (fe_insert_admin/fe_select_admin/fe_delete_admin,
-- migracion 20260710000001). Se agregan las policies equivalentes para
-- equipos con acceso a Marketing Admin.

CREATE POLICY "fe_select_mkt_equipo"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos-estudio' AND
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "fe_insert_mkt_equipo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-estudio' AND
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "fe_delete_mkt_equipo"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos-estudio' AND
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
