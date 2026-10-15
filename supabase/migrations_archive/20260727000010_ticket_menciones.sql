-- Tabla de menciones: hace visible el trámite al usuario mencionado
CREATE TABLE IF NOT EXISTS ticket_usuarios_mencionados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mencionado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(ticket_id, usuario_id)
);

ALTER TABLE ticket_usuarios_mencionados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menciones_select_auth"
  ON ticket_usuarios_mencionados FOR SELECT TO authenticated USING (true);

CREATE POLICY "menciones_insert_auth"
  ON ticket_usuarios_mencionados FOR INSERT TO authenticated
  WITH CHECK (mencionado_por = auth.uid());

-- Política adicional en tickets: si el usuario fue mencionado, puede ver el trámite
-- Se agrega como política permissiva extra (se combina con OR con las existentes).
CREATE POLICY "tickets_mencionados_select"
  ON tickets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ticket_usuarios_mencionados
      WHERE ticket_id = id AND usuario_id = auth.uid()
    )
  );
