-- MERCADOTECNIA (y cualquier equipo con store_equipos_acceso) debe ver/operar el
-- panel completo de un pedido igual que Admin: Ingresos/Costos, Gastos, Control de
-- Pagos, Cambiar Estatus, Notas internas. El frontend (StorePedidoDetalle.tsx) solo
-- checaba usuario.rol Administrador/Gerente; estas tablas solo tenian RLS para Admin
-- (o para el dueno del pedido en notas/historial), sin la clausula de equipo que ya
-- existe en store_pedidos desde 20260702000010.

-- store_pedidos_notas: equipo con acceso puede ver y crear notas de cualquier pedido
CREATE POLICY "store_pedidos_notas_equipo_ver" ON store_pedidos_notas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_pedidos_notas_equipo_crear" ON store_pedidos_notas
  FOR INSERT TO authenticated
  WITH CHECK (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- store_pedidos_historial: equipo con acceso puede ver y registrar cambios de estatus
-- de cualquier pedido (actualizarEstatusPedido inserta aqui al cambiar estatus)
CREATE POLICY "store_pedidos_historial_equipo_ver" ON store_pedidos_historial
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_pedidos_historial_equipo_crear" ON store_pedidos_historial
  FOR INSERT TO authenticated
  WITH CHECK (
    cambiado_por = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- store_pedido_gastos / store_pedido_detalle_gastos: SELECT ya es abierto a cualquier
-- autenticado; INSERT/UPDATE/DELETE solo dejaban Administrador/Gerente (fix del
-- 2026-05-20). Se agrega equipo con acceso.
CREATE POLICY "store_pedido_gastos_equipo_insert" ON store_pedido_gastos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_pedido_gastos_equipo_update" ON store_pedido_gastos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_pedido_gastos_equipo_delete" ON store_pedido_gastos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_pedido_detalle_gastos_equipo_insert" ON store_pedido_detalle_gastos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_pedido_detalle_gastos_equipo_update" ON store_pedido_detalle_gastos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_pedido_detalle_gastos_equipo_delete" ON store_pedido_detalle_gastos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- Hallazgo aparte (afecta tambien a Administrador, no solo a equipos): nunca existio
-- una politica UPDATE para store_pedidos_detalle, asi que el input "Costo unit." del
-- panel (handleSaveCostoOverride) fallaba siempre en silencio para todos los roles.
CREATE POLICY "store_pedidos_detalle_admin_equipo_update" ON store_pedidos_detalle
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'
    )
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
