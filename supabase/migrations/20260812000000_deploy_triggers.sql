-- Bitacora de deploys disparados desde MOVI (boton Admin > Deploy).
-- El disparo real (llamada al webhook de Plesk) lo hace la edge function
-- trigger-deploy con la service role key; esta tabla es solo para historial.
CREATE TABLE IF NOT EXISTS deploy_triggers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  target      text        NOT NULL CHECK (target IN ('beta', 'produccion')),
  status_code int,
  ok          boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deploy_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deploy_triggers_admin_all" ON deploy_triggers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );
