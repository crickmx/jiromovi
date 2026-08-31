-- Catálogos de productos para tienda.movi.digital
CREATE TABLE IF NOT EXISTS store_catalogos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  slug text UNIQUE NOT NULL,
  descripcion text,
  imagen_portada_url text,
  activo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Productos en cada catálogo (N:M — un producto puede estar en varios catálogos)
CREATE TABLE IF NOT EXISTS store_catalogo_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_id uuid NOT NULL REFERENCES store_catalogos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES store_productos(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  UNIQUE(catalogo_id, producto_id)
);

ALTER TABLE store_catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_catalogo_productos ENABLE ROW LEVEL SECURITY;

-- Anon: solo catálogos activos
CREATE POLICY "store_catalogos_anon_select" ON store_catalogos
  FOR SELECT TO anon USING (activo = true);

CREATE POLICY "store_catalogos_auth_select" ON store_catalogos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "store_catalogos_admin_all" ON store_catalogos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_catalogo_productos_anon_select" ON store_catalogo_productos
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM store_catalogos WHERE id = catalogo_id AND activo = true)
  );

CREATE POLICY "store_catalogo_productos_auth_select" ON store_catalogo_productos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "store_catalogo_productos_admin_all" ON store_catalogo_productos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
