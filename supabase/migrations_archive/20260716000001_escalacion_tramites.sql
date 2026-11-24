-- Nuevos roles de equipo: supervisor y director
ALTER TABLE tramites_grupos_miembros
  DROP CONSTRAINT IF EXISTS tramites_grupos_miembros_rol_en_equipo_check;

ALTER TABLE tramites_grupos_miembros
  ADD CONSTRAINT tramites_grupos_miembros_rol_en_equipo_check
  CHECK (rol_en_equipo IN ('lider', 'ejecutivo', 'miembro', 'supervisor', 'director'));

-- Triggers de escalación: notifican al supervisor/director sin crear trámite hijo
CREATE TABLE ticket_escalacion_triggers (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_tipo_id  uuid    NOT NULL REFERENCES ticket_tipos(id) ON DELETE CASCADE,
  from_status     text    NOT NULL,
  destinatario    text    NOT NULL CHECK (destinatario IN ('supervisor', 'director', 'ambos')),
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE ticket_escalacion_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON ticket_escalacion_triggers FOR ALL
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

CREATE POLICY "auth_read_active" ON ticket_escalacion_triggers FOR SELECT
  TO authenticated USING (activo = true);
