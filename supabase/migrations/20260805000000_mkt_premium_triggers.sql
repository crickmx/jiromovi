-- Motor de reglas configurables para Marketing Premium, mismo patron que
-- store_tramite_triggers/store_tramite_trigger_campos (Store <-> Tramites):
-- antes, la creacion del ticket de cobranza estaba fija en el codigo
-- (MarketingPremiumAdmin.tsx: crearTramiteCobranzaPremium), solo disparaba
-- en la activacion y siempre creaba tipo "cobranza" con texto fijo.
--
-- Ahora el admin/equipo de Marketing define reglas desde una pantalla:
-- "cuando pase [evento] en el premium de un agente -> crear ticket de tipo Y",
-- con plantilla de texto y mapeo de campos por trigger, igual que Store.

-- 1. Catalogo de eventos disparadores (equivalente a store_estatus_pedidos)
CREATE TABLE IF NOT EXISTS mkt_premium_eventos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL UNIQUE,
  nombre     text        NOT NULL,
  orden      integer     NOT NULL DEFAULT 0,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mkt_premium_eventos (key, nombre, orden) VALUES
  ('activacion',         'Se activa el Premium',                                     1),
  ('desactivacion',      'Se desactiva el Premium',                                  2),
  ('cambio_metodo_pago', 'Cambia el metodo de pago (estando activo)',                3),
  ('actualizacion',      'Se actualizan plan/fechas/parcialidades (estando activo)', 4)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE mkt_premium_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_premium_eventos_read" ON mkt_premium_eventos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mkt_premium_eventos_admin_all" ON mkt_premium_eventos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- 2. Reglas: evento -> crea ticket de tipo Y (equivalente a store_tramite_triggers)
CREATE TABLE IF NOT EXISTS mkt_premium_triggers (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                text        NOT NULL,
  evento_id             uuid        NOT NULL REFERENCES mkt_premium_eventos(id) ON DELETE CASCADE,
  ticket_tipo_id        uuid        NOT NULL REFERENCES ticket_tipos(id) ON DELETE CASCADE,
  descripcion_template  text        NOT NULL DEFAULT '',
  metodo_pago_filtro    text[],
  activo                boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_premium_triggers_evento ON mkt_premium_triggers(evento_id) WHERE activo = true;

ALTER TABLE mkt_premium_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_premium_triggers_read" ON mkt_premium_triggers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mkt_premium_triggers_admin_all" ON mkt_premium_triggers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

CREATE POLICY "mkt_premium_triggers_equipo_all" ON mkt_premium_triggers
  FOR ALL TO authenticated
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

-- 3. Mapeo de campos por trigger (equivalente a store_tramite_trigger_campos,
-- sin 'adjunto_oc' porque Marketing Premium no genera un PDF equivalente a la OC)
CREATE TABLE IF NOT EXISTS mkt_premium_trigger_campos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id     uuid        NOT NULL REFERENCES mkt_premium_triggers(id) ON DELETE CASCADE,
  campo_id       uuid        NOT NULL REFERENCES tramite_tipo_campos(id) ON DELETE CASCADE,
  fuente         text        NOT NULL DEFAULT 'vacio' CHECK (fuente IN ('vacio', 'template')),
  valor_template text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trigger_id, campo_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_premium_trigger_campos_trigger ON mkt_premium_trigger_campos(trigger_id);

ALTER TABLE mkt_premium_trigger_campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_premium_trigger_campos_read" ON mkt_premium_trigger_campos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mkt_premium_trigger_campos_admin_all" ON mkt_premium_trigger_campos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

CREATE POLICY "mkt_premium_trigger_campos_equipo_all" ON mkt_premium_trigger_campos
  FOR ALL TO authenticated
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

-- 4. Seed: recrea el comportamiento anterior (activacion -> Cobranza) como
-- una regla editable, para no perder la funcionalidad existente.
INSERT INTO mkt_premium_triggers (nombre, evento_id, ticket_tipo_id, descripcion_template, activo)
SELECT
  'Cobro de Marketing Premium activado',
  (SELECT id FROM mkt_premium_eventos WHERE key = 'activacion'),
  (SELECT id FROM ticket_tipos WHERE value = 'cobranza'),
  'Cobro de Marketing Premium activado para {{nombre_completo}}.' || chr(10) ||
  'Plan: {{plan}}' || chr(10) ||
  'Metodo de pago: {{metodo_pago}}' || chr(10) ||
  'Parcialidades: {{parcialidades}}' || chr(10) ||
  'Fecha de inicio: {{fecha_inicio}}' || chr(10) ||
  'Fecha de proximo pago: {{fecha_pago}}' || chr(10) ||
  'Oficina: {{oficina}}',
  true
WHERE EXISTS (SELECT 1 FROM ticket_tipos WHERE value = 'cobranza')
  AND NOT EXISTS (SELECT 1 FROM mkt_premium_triggers WHERE nombre = 'Cobro de Marketing Premium activado');
