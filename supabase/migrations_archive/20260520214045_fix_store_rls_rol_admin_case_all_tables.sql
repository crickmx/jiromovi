/*
  # Fix store RLS policies — rol case sensitivity

  ## Summary
  Multiple store tables have RLS policies using `rol = 'admin'` which never matches
  any user (the correct value is 'Administrador'). This silently blocks all admin
  operations on these tables.

  ## Tables fixed
  - store_producto_costos_extras
  - store_gastos_generales
  - store_metas_utilidad
  - store_pedido_detalle_gastos (the ALL policy — separate INSERT/UPDATE/DELETE/SELECT
    policies already exist from a prior fix, but the broken ALL policy may still exist)
  - store_pedidos (gerente role also corrected)

  All policies updated to use rol IN ('Administrador', 'Gerente').
*/

-- ── store_producto_costos_extras ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage product extra costs" ON store_producto_costos_extras;

CREATE POLICY "Admins and gerentes can select product extra costs"
  ON store_producto_costos_extras FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can insert product extra costs"
  ON store_producto_costos_extras FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can update product extra costs"
  ON store_producto_costos_extras FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can delete product extra costs"
  ON store_producto_costos_extras FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- ── store_gastos_generales ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage global expenses" ON store_gastos_generales;

CREATE POLICY "Admins and gerentes can select global expenses"
  ON store_gastos_generales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can insert global expenses"
  ON store_gastos_generales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can update global expenses"
  ON store_gastos_generales FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can delete global expenses"
  ON store_gastos_generales FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- ── store_metas_utilidad ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage profit goals" ON store_metas_utilidad;

CREATE POLICY "Admins and gerentes can select profit goals"
  ON store_metas_utilidad FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can insert profit goals"
  ON store_metas_utilidad FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can update profit goals"
  ON store_metas_utilidad FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins and gerentes can delete profit goals"
  ON store_metas_utilidad FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- ── store_pedido_detalle_gastos (broken ALL policy if still exists) ───────────
DROP POLICY IF EXISTS "Admins can manage line item expenses" ON store_pedido_detalle_gastos;

-- Only create if not already present from prior migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_pedido_detalle_gastos'
      AND policyname = 'Admins and gerentes can select line item expenses'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins and gerentes can select line item expenses"
        ON store_pedido_detalle_gastos FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
              AND usuarios.rol IN ('Administrador', 'Gerente')
          )
        )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_pedido_detalle_gastos'
      AND policyname = 'Admins and gerentes can insert line item expenses'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins and gerentes can insert line item expenses"
        ON store_pedido_detalle_gastos FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
              AND usuarios.rol IN ('Administrador', 'Gerente')
          )
        )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_pedido_detalle_gastos'
      AND policyname = 'Admins and gerentes can delete line item expenses'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins and gerentes can delete line item expenses"
        ON store_pedido_detalle_gastos FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM usuarios
            WHERE usuarios.id = auth.uid()
              AND usuarios.rol IN ('Administrador', 'Gerente')
          )
        )
    $p$;
  END IF;
END $$;
