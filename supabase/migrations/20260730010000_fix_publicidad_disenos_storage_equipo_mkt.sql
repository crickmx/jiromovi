-- La subida de "contenido semanal" desde /mercadotecnia/admin (Marketing
-- Premium) falla con "new row violates row-level security policy": la
-- policy de INSERT en el bucket publicidad-disenos
-- ("Usuarios pueden subir sus propios diseños", migracion 20251029214515)
-- exige que el primer segmento de la ruta sea el auth.uid() de quien sube.
-- El path usado para contenido de equipo (equipo-mkt/{id_del_agente}/...)
-- nunca cumple eso, porque quien sube es el admin/equipo de Marketing,
-- no el agente. Se agrega el bypass equivalente al ya usado en
-- fotos-estudio (fe_insert_admin) y en la propia tabla publicidad_disenos
-- (mkt_equipo_can_insert_disenos, migracion 20260730000000).

CREATE POLICY "mkt_equipo_can_insert_disenos_storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'publicidad-disenos' AND (
      EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
      OR EXISTS (
        SELECT 1 FROM tramites_grupos_miembros tgm
        JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
        WHERE tgm.usuario_id = auth.uid()
      )
    )
  );
