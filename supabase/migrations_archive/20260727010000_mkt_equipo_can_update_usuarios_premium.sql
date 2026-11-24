-- TK0B51A: quitar/activar Marketing Premium a un agente desde
-- /mercadotecnia/admin no se guardaba para miembros de equipo con acceso
-- (mkt_equipos_acceso) — solo Admin, Gerente (misma oficina) o el propio
-- usuario pueden actualizar la tabla usuarios. Se agrega la policy que
-- faltaba para equipos con acceso a Marketing Admin.

CREATE POLICY "mkt_equipo_can_update_usuarios" ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
