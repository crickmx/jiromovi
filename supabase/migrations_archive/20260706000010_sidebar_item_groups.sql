-- Extiende el Editor de Sidebar al panel blanco (SecondarySidebar): permite
-- agrupar los items de una sección en grupos colapsables, reordenar items
-- dentro/entre grupos, y ponerles badge — igual que ya existe para los
-- íconos de la barra angosta (sidebar_config).

CREATE TABLE IF NOT EXISTS sidebar_grupos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       text NOT NULL, -- WorkspaceId (comercial, administracion, etc.)
  nombre             text NOT NULL,
  orden              integer NOT NULL DEFAULT 0,
  colapsado_default  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sidebar_item_config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_path    text NOT NULL UNIQUE, -- path del WorkspaceNavItem
  orden        integer NOT NULL DEFAULT 0,
  grupo_id     uuid REFERENCES sidebar_grupos(id) ON DELETE SET NULL,
  badge_texto  text,
  badge_color  text NOT NULL DEFAULT 'amber',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES usuarios(id)
);

ALTER TABLE sidebar_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sidebar_item_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sidebar_grupos_select_authenticated"
  ON sidebar_grupos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sidebar_grupos_write_admin"
  ON sidebar_grupos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

CREATE POLICY "sidebar_item_config_select_authenticated"
  ON sidebar_item_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sidebar_item_config_write_admin"
  ON sidebar_item_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
