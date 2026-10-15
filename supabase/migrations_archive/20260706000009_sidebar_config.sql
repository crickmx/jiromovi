-- Editor de Sidebar: permite reordenar los íconos de la barra angosta,
-- agregar separadores visuales entre grupos, y ponerle un badge de texto
-- (ej. "BETA"/"NUEVO") a cualquier ícono. No crea páginas ni cambia rutas —
-- solo reordena/decora los ~13 íconos que ya existen (workspaceConfig.ts).
CREATE TABLE IF NOT EXISTS sidebar_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_key        text NOT NULL UNIQUE, -- path del top-level item, o id del workspace
  orden            integer NOT NULL,
  separador_antes  boolean NOT NULL DEFAULT false,
  badge_texto      text,
  badge_color      text NOT NULL DEFAULT 'amber',
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES usuarios(id)
);

ALTER TABLE sidebar_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sidebar_config_select_authenticated"
  ON sidebar_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sidebar_config_write_admin"
  ON sidebar_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
