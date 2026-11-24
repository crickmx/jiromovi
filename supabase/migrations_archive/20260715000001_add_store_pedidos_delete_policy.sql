-- store_pedidos nunca tuvo policy de DELETE (ni para Admin ni para equipos con acceso).
-- RLS bloquea por default sin policy → el boton "Eliminar" en StorePedidos.tsx fallaba
-- en silencio para todos, reportado por el equipo de Mercadotecnia.

CREATE POLICY "store_pedidos_admin_delete" ON store_pedidos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "store_pedidos_equipo_delete" ON store_pedidos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
