-- Separador visual independiente para el panel blanco del Editor de Sidebar (SecondarySidebar).
-- A diferencia de sidebar_config.separador_antes (que va PEGADO a un ícono de la barra angosta),
-- este es un elemento propio dentro de la lista de items de una sección/grupo -- se puede
-- arrastrar y colocar en cualquier posición, sin depender de ningún item del menú.

CREATE TABLE IF NOT EXISTS sidebar_separadores (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text        NOT NULL,
  grupo_id     uuid        REFERENCES sidebar_grupos(id) ON DELETE CASCADE,
  orden        integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sidebar_separadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sidebar_separadores_select_authenticated"
  ON sidebar_separadores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sidebar_separadores_write_admin"
  ON sidebar_separadores FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));
