-- store_pedidos ya tiene "store_pedidos_equipo_acceso" (20260702000010) para que
-- miembros de equipo con store_equipos_acceso vean cualquier pedido, pero
-- store_pedidos_detalle solo tenia politicas de Admin y de dueno -- por eso un
-- miembro de equipo veia la cabecera del pedido pero Productos/Total en blanco.

CREATE POLICY "store_pedidos_detalle_equipo_acceso" ON store_pedidos_detalle
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
