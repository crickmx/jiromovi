-- Editor de Dashboard: permite editar/reordenar las Vcards de colores del grid
-- principal (título, descripción, emoji, colores, orden, activa/inactiva) y
-- reordenar/activar los widgets de la columna derecha (Favoritos, Únete a la
-- Beta, Mi Producción, Avisos) sin tocar código. La visibilidad por
-- rol/oficina/usuario se resuelve con la tabla module_visibility ya existente
-- (mismo motor que Control de Módulos), usando module_key = 'dashboard:vcard:<card_key>'
-- / 'dashboard:widget:<widget_key>'.

CREATE TABLE IF NOT EXISTS dashboard_vcards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_key       text NOT NULL UNIQUE,
  label          text NOT NULL,
  descripcion    text NOT NULL DEFAULT '',
  route          text NOT NULL,
  emoji          text NOT NULL DEFAULT '📦',
  gradient_from  text NOT NULL DEFAULT '#5A6EC4',
  gradient_to    text NOT NULL DEFAULT '#333D90',
  orden          integer NOT NULL DEFAULT 0,
  activa         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES usuarios(id)
);

ALTER TABLE dashboard_vcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_vcards_select_authenticated"
  ON dashboard_vcards FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dashboard_vcards_write_admin"
  ON dashboard_vcards FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- Semilla con las 5 Vcards actuales (BETA_MODULES hardcodeado en Dashboard.tsx),
-- mismo orden/colores/textos que ya se ven hoy, para no regresionar nada.
INSERT INTO dashboard_vcards (card_key, label, descripcion, route, emoji, gradient_from, gradient_to, orden) VALUES
  ('store',      'MOVI Store',            'Pedidos y catálogo de productos',   '/store',                     '🏬', '#E84F8A', '#8E1A52', 1),
  ('educacion',  'Seguros Education',     'Cursos y certificaciones',          '/seguros-education',         '🎓', '#5A6EC4', '#333D90', 2),
  ('produccion', 'Central de Producción', 'Pólizas, reportes y metas',         '/produccion',                '📊', '#8E1A52', '#520E35', 3),
  ('marketing',  'Mercadotecnia',         'Campañas y materiales de marca',    '/mercadotecnia/publicidad',  '📣', '#3DA88A', '#236B58', 4),
  ('avisos',     'Avisos',                'Comunicados y notificaciones',      '/comunicados',               '🔔', '#B87272', '#7A4858', 5)
ON CONFLICT (card_key) DO NOTHING;

-- full_width=true: se renderiza en la columna izquierda, ancho completo (para
-- widgets con mucho contenido, ej. Mi Producción). false: columna derecha
-- angosta (Favoritos, Únete a la Beta, Avisos) — mismo layout de hoy.
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key  text NOT NULL UNIQUE,
  orden       integer NOT NULL DEFAULT 0,
  activa      boolean NOT NULL DEFAULT true,
  full_width  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES usuarios(id)
);

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_widgets_select_authenticated"
  ON dashboard_widgets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dashboard_widgets_write_admin"
  ON dashboard_widgets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

-- Semilla con los 4 widgets fijos, mismo orden/posición que hoy: 3 angostos en
-- la columna derecha + Mi Producción a ancho completo bajo el grid de Vcards.
-- No tienen label/color editable (son componentes con lógica propia, no
-- tarjetas genéricas) — solo orden, ancho y activa/inactiva.
INSERT INTO dashboard_widgets (widget_key, orden, full_width) VALUES
  ('produccion_bonos', 1, true),
  ('favoritos',        1, false),
  ('beta',             2, false),
  ('avisos',           3, false)
ON CONFLICT (widget_key) DO NOTHING;
