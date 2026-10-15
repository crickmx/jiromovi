-- ═══════════════════════════════════════════════════════════════════
-- FASE 0: Sistema de Triggers de Estatus
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Categorías de adjuntos ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS maestro_adjunto_categorias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  descripcion text,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE maestro_adjunto_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adjunto_cat_select" ON maestro_adjunto_categorias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "adjunto_cat_admin" ON maestro_adjunto_categorias
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- Categorías iniciales
INSERT INTO maestro_adjunto_categorias (nombre, descripcion) VALUES
  ('Póliza',            'Documento oficial de la póliza emitida'),
  ('Comprobante pago',  'Comprobante o recibo de pago'),
  ('Identificación',    'Documento de identidad del cliente'),
  ('Nota interna',      'Notas internas — no compartir con otras áreas'),
  ('Otro',              'Adjunto sin categoría específica')
ON CONFLICT DO NOTHING;

-- ── 2. Columna categoria_id en ticket_archivos ────────────────────
ALTER TABLE ticket_archivos
  ADD COLUMN IF NOT EXISTS categoria_id uuid
    REFERENCES maestro_adjunto_categorias(id) ON DELETE SET NULL;

-- ── 3. Columna parent_ticket_id en tickets ────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS parent_ticket_id uuid
    REFERENCES tickets(id) ON DELETE SET NULL;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS trigger_origen_id uuid; -- se llenará tras crear ticket_status_triggers

CREATE INDEX IF NOT EXISTS idx_tickets_parent ON tickets(parent_ticket_id);

-- ── 4. Tabla de triggers de estatus ──────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_status_triggers (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_tipo_id          uuid        NOT NULL REFERENCES ticket_tipos(id) ON DELETE CASCADE,
  from_status             text        NOT NULL,
  target_tipo_id          uuid        NOT NULL REFERENCES ticket_tipos(id) ON DELETE CASCADE,
  initial_status          text        NOT NULL DEFAULT 'Abierto',
  prioridad_hijo          text        NOT NULL DEFAULT 'heredar'
                            CHECK (prioridad_hijo IN ('heredar','Alta','Media','Baja')),
  nombre                  text        NOT NULL,
  requiere_confirmacion   boolean     NOT NULL DEFAULT true,
  adjunto_categorias_ids  uuid[]      NOT NULL DEFAULT '{}',
  activo                  boolean     NOT NULL DEFAULT true,
  created_by              uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triggers_tipo_status
  ON ticket_status_triggers(ticket_tipo_id, from_status)
  WHERE activo = true;

ALTER TABLE ticket_status_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "triggers_select" ON ticket_status_triggers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "triggers_admin" ON ticket_status_triggers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- Ahora que existe la tabla, conectar la FK en tickets
ALTER TABLE tickets
  ADD CONSTRAINT fk_tickets_trigger_origen
    FOREIGN KEY (trigger_origen_id)
    REFERENCES ticket_status_triggers(id)
    ON DELETE SET NULL;

-- ── 5. Mapeo de campos por trigger ───────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_trigger_field_mappings (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id          uuid    NOT NULL REFERENCES ticket_status_triggers(id) ON DELETE CASCADE,
  -- campo origen (null si es valor fijo o campo sistema)
  source_campo_id     uuid    REFERENCES tramite_tipo_campos(id) ON DELETE SET NULL,
  source_sistema_key  text,   -- 'poliza_numero', 'asignado', 'prioridad', etc.
  -- campo destino
  target_campo_id     uuid    REFERENCES tramite_tipo_campos(id) ON DELETE SET NULL,
  target_sistema_key  text,
  -- valor fijo alternativo al mapeo
  valor_fijo          text,
  orden               integer NOT NULL DEFAULT 0,
  -- al menos uno de los tres debe estar presente
  CONSTRAINT mapping_tiene_origen CHECK (
    source_campo_id IS NOT NULL
    OR source_sistema_key IS NOT NULL
    OR valor_fijo IS NOT NULL
  ),
  CONSTRAINT mapping_tiene_destino CHECK (
    target_campo_id IS NOT NULL
    OR target_sistema_key IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_field_mappings_trigger
  ON ticket_trigger_field_mappings(trigger_id);

ALTER TABLE ticket_trigger_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_mappings_select" ON ticket_trigger_field_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "field_mappings_admin" ON ticket_trigger_field_mappings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- ── 6. Log de ejecuciones ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_trigger_executions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id        uuid        REFERENCES ticket_status_triggers(id) ON DELETE SET NULL,
  parent_ticket_id  uuid        REFERENCES tickets(id) ON DELETE CASCADE,
  child_ticket_id   uuid        REFERENCES tickets(id) ON DELETE SET NULL,
  ejecutado_por     uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  estatus           text        NOT NULL DEFAULT 'ok'
                      CHECK (estatus IN ('ok','error','skipped')),
  error_msg         text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executions_trigger ON ticket_trigger_executions(trigger_id);
CREATE INDEX IF NOT EXISTS idx_executions_parent  ON ticket_trigger_executions(parent_ticket_id);

ALTER TABLE ticket_trigger_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executions_select_admin" ON ticket_trigger_executions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

CREATE POLICY "executions_insert_auth" ON ticket_trigger_executions
  FOR INSERT TO authenticated WITH CHECK (true);
