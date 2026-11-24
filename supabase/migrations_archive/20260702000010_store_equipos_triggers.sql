-- ============================================================
-- MOVI Store ↔ Trámites integration
-- ============================================================

-- 1. Equipos con acceso al store (pueden ver todos los pedidos)
CREATE TABLE IF NOT EXISTS store_equipos_acceso (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id    uuid        NOT NULL REFERENCES tramites_grupos_visualizacion(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grupo_id)
);

ALTER TABLE store_equipos_acceso ENABLE ROW LEVEL SECURITY;

-- Admins gestionan; todos los usuarios autenticados pueden leer (para saber si tienen acceso)
CREATE POLICY "store_equipos_acceso_admin_all" ON store_equipos_acceso
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

CREATE POLICY "store_equipos_acceso_read" ON store_equipos_acceso
  FOR SELECT TO authenticated USING (true);

-- 2. RLS adicional en store_pedidos: miembros de equipo con acceso pueden ver todos los pedidos
-- (Se agrega como política extra; las políticas existentes ya cubren dueños y admins)
CREATE POLICY "store_pedidos_equipo_acceso" ON store_pedidos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- También permitir UPDATE a miembros de equipo con acceso
CREATE POLICY "store_pedidos_equipo_update" ON store_pedidos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- 3. Vincular tickets con pedidos del store (para el badge de notificaciones)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS store_pedido_id uuid REFERENCES store_pedidos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_store_pedido_id ON tickets(store_pedido_id) WHERE store_pedido_id IS NOT NULL;

-- 4. Reglas configurables: cuando estatus cambia A X → crear ticket tipo Y
CREATE TABLE IF NOT EXISTS store_tramite_triggers (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text        NOT NULL,
  estatus_destino_id    uuid        NOT NULL REFERENCES store_estatus_pedidos(id) ON DELETE CASCADE,
  ticket_tipo_id        uuid        NOT NULL REFERENCES ticket_tipos(id) ON DELETE CASCADE,
  descripcion_template  text        NOT NULL DEFAULT '',
  activo                boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_tramite_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_tramite_triggers_admin_all" ON store_tramite_triggers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador'
    )
  );

CREATE POLICY "store_tramite_triggers_read" ON store_tramite_triggers
  FOR SELECT TO authenticated USING (true);
