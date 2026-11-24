/*
  Allow admins to manage store_carrito, store_pedidos, and store_pedidos_detalle
  on behalf of any user (required for the impersonation/mask feature).
*/

-- ── store_carrito: Admins can manage any user's cart ─────────────────────────

CREATE POLICY "Admins pueden ver todo el carrito"
  ON store_carrito FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden agregar al carrito de cualquier usuario"
  ON store_carrito FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden actualizar carrito de cualquier usuario"
  ON store_carrito FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden eliminar del carrito de cualquier usuario"
  ON store_carrito FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

-- ── store_pedidos: Admins can create orders on behalf of any user ────────────

CREATE POLICY "Admins pueden crear pedidos para cualquier usuario"
  ON store_pedidos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

-- ── store_pedidos_detalle: Admins can insert detail for any order ────────────

CREATE POLICY "Admins pueden agregar detalle a cualquier pedido"
  ON store_pedidos_detalle FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );

-- ── store_pedidos_historial: Admins can insert historial for any order ───────

DROP POLICY IF EXISTS "Admins pueden agregar historial" ON store_pedidos_historial;

CREATE POLICY "Admins pueden agregar historial"
  ON store_pedidos_historial FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Administrador'
    )
  );
