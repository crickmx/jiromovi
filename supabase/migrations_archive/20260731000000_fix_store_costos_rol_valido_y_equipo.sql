-- Mismo bug recurrente de la sesion: las policies del sistema de costos de
-- Store (creado en 20260519163202_create_store_costs_expenses_goals_system.sql)
-- comparan rol = 'admin', valor que nunca existe en usuarios.rol (el real es
-- 'Administrador'). Esto significa que NADIE -ni siquiera un Administrador-
-- ha podido agregar costos extra por producto, gastos de pedido, gastos
-- generales ni metas de utilidad desde la app.
--
-- Se aprovecha para agregar tambien el bypass de store_equipos_acceso
-- (igual que ya tiene store_productos/store_categorias desde
-- 20260703000002), para que el equipo de Marketing -agregado a
-- "Equipos con acceso al store"- pueda gestionar costos de produccion de
-- los productos sin necesitar ser Administrador.

-- ── store_producto_costos_extras ────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage product extra costs" ON store_producto_costos_extras;

CREATE POLICY "store_producto_costos_extras_admin_equipo" ON store_producto_costos_extras
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- ── store_pedido_gastos ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage order expenses" ON store_pedido_gastos;

CREATE POLICY "store_pedido_gastos_admin_equipo" ON store_pedido_gastos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- ── store_pedido_detalle_gastos ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage line item expenses" ON store_pedido_detalle_gastos;

CREATE POLICY "store_pedido_detalle_gastos_admin_equipo" ON store_pedido_detalle_gastos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- ── store_gastos_generales ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage global expenses" ON store_gastos_generales;

CREATE POLICY "store_gastos_generales_admin_equipo" ON store_gastos_generales
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- ── store_metas_utilidad ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage profit goals" ON store_metas_utilidad;

CREATE POLICY "store_metas_utilidad_admin_equipo" ON store_metas_utilidad
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
