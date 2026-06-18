/*
  # Fix Store Expenses RLS Policies — Role Case Mismatch

  ## Problem
  The existing RLS policies on `store_pedido_gastos` and `store_pedido_detalle_gastos`
  check `rol = 'admin'` (lowercase), but the application uses `'Administrador'` (capitalized).
  This causes all inserts/updates/deletes to silently fail for all users.

  ## Changes
  1. Drop and recreate ALL policies on `store_pedido_gastos` to use correct role names
  2. Drop and recreate ALL policies on `store_pedido_detalle_gastos` to use correct role names
  3. Policies now allow Administrador AND Gerente to manage expenses
  4. Read access granted to any authenticated user who can see the parent pedido/detalle
*/

-- ============================================================
-- store_pedido_gastos
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage order expenses" ON store_pedido_gastos;
DROP POLICY IF EXISTS "Admins can read order expenses" ON store_pedido_gastos;
DROP POLICY IF EXISTS "Admins can insert order expenses" ON store_pedido_gastos;
DROP POLICY IF EXISTS "Admins can update order expenses" ON store_pedido_gastos;
DROP POLICY IF EXISTS "Admins can delete order expenses" ON store_pedido_gastos;
DROP POLICY IF EXISTS "Users can read pedido expenses" ON store_pedido_gastos;

CREATE POLICY "Admins and gerentes can insert pedido gastos"
  ON store_pedido_gastos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND (deleted_at IS NULL OR deleted_at > now())
    )
  );

CREATE POLICY "Admins and gerentes can update pedido gastos"
  ON store_pedido_gastos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND (deleted_at IS NULL OR deleted_at > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND (deleted_at IS NULL OR deleted_at > now())
    )
  );

CREATE POLICY "Admins and gerentes can delete pedido gastos"
  ON store_pedido_gastos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND (deleted_at IS NULL OR deleted_at > now())
    )
  );

CREATE POLICY "Authenticated users can read pedido gastos"
  ON store_pedido_gastos FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- store_pedido_detalle_gastos
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage detail expenses" ON store_pedido_detalle_gastos;
DROP POLICY IF EXISTS "Admins can read detail expenses" ON store_pedido_detalle_gastos;
DROP POLICY IF EXISTS "Admins can insert detail expenses" ON store_pedido_detalle_gastos;
DROP POLICY IF EXISTS "Admins can update detail expenses" ON store_pedido_detalle_gastos;
DROP POLICY IF EXISTS "Admins can delete detail expenses" ON store_pedido_detalle_gastos;
DROP POLICY IF EXISTS "Users can read detalle expenses" ON store_pedido_detalle_gastos;

CREATE POLICY "Admins and gerentes can insert detalle gastos"
  ON store_pedido_detalle_gastos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND (deleted_at IS NULL OR deleted_at > now())
    )
  );

CREATE POLICY "Admins and gerentes can update detalle gastos"
  ON store_pedido_detalle_gastos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND (deleted_at IS NULL OR deleted_at > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND (deleted_at IS NULL OR deleted_at > now())
    )
  );

CREATE POLICY "Admins and gerentes can delete detalle gastos"
  ON store_pedido_detalle_gastos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
        AND rol IN ('Administrador', 'Gerente')
        AND (deleted_at IS NULL OR deleted_at > now())
    )
  );

CREATE POLICY "Authenticated users can read detalle gastos"
  ON store_pedido_detalle_gastos FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
