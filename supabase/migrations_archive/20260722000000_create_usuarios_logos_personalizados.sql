CREATE TABLE IF NOT EXISTS usuarios_logos_personalizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT 'Logo',
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE usuarios_logos_personalizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_logos_personalizados_propio" ON usuarios_logos_personalizados
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "usuarios_logos_personalizados_admin_select" ON usuarios_logos_personalizados
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE INDEX IF NOT EXISTS idx_usuarios_logos_personalizados_usuario_id ON usuarios_logos_personalizados(usuario_id);
