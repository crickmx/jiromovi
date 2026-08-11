-- Control de presupuestos de campanias de redes sociales para el equipo de
-- Marketing: cada campania tiene un presupuesto asignado, plataforma y
-- fechas; los gastos reales se registran uno por uno contra la campania
-- (fecha, concepto, monto), para poder auditar despues en que se gasto.
--
-- Datos financieros -> mismo patron de RLS que store_gastos_generales /
-- store_metas_utilidad: solo Administrador o equipo con acceso a Marketing
-- Admin (mkt_equipos_acceso), sin policy de lectura publica.

CREATE TABLE IF NOT EXISTS mkt_campanias (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text        NOT NULL,
  plataforma            text        NOT NULL DEFAULT 'Otro',
  presupuesto_asignado  numeric(10,2) NOT NULL DEFAULT 0 CHECK (presupuesto_asignado >= 0),
  fecha_inicio          date,
  fecha_fin             date,
  descripcion           text,
  usuario_id            uuid        NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  oficina_id            uuid        NOT NULL REFERENCES oficinas(id) ON DELETE RESTRICT,
  activa                boolean     NOT NULL DEFAULT true,
  created_by            uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_campanias_usuario ON mkt_campanias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mkt_campanias_oficina ON mkt_campanias(oficina_id);

CREATE INDEX IF NOT EXISTS idx_mkt_campanias_activa ON mkt_campanias(activa);

CREATE TABLE IF NOT EXISTS mkt_campania_gastos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campania_id  uuid        NOT NULL REFERENCES mkt_campanias(id) ON DELETE CASCADE,
  fecha        date        NOT NULL DEFAULT CURRENT_DATE,
  concepto     text        NOT NULL,
  monto        numeric(10,2) NOT NULL DEFAULT 0 CHECK (monto >= 0),
  created_by   uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_campania_gastos_campania ON mkt_campania_gastos(campania_id);

ALTER TABLE mkt_campanias ENABLE ROW LEVEL SECURITY;
ALTER TABLE mkt_campania_gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_campanias_admin_equipo_all" ON mkt_campanias
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "mkt_campania_gastos_admin_equipo_all" ON mkt_campania_gastos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
