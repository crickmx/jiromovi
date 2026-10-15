/*
  # Crear módulo Store completo

  1. Nuevas Tablas
    - `store_categorias`: Categorías de productos
    - `store_productos`: Productos del store
    - `store_carrito`: Carrito persistente por usuario
    - `store_estatus_pedidos`: Estatus configurables
    - `store_pedidos`: Pedidos realizados
    - `store_pedidos_detalle`: Productos de cada pedido
    - `store_pedidos_notas`: Notas internas del admin
    - `store_pedidos_historial`: Historial de cambios de estatus

  2. Seguridad
    - Enable RLS en todas las tablas
    - Políticas específicas por rol
*/

-- Crear tabla de categorías
CREATE TABLE IF NOT EXISTS store_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de productos
CREATE TABLE IF NOT EXISTS store_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid REFERENCES store_categorias(id) ON DELETE RESTRICT,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  imagen_url text NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de carrito
CREATE TABLE IF NOT EXISTS store_carrito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES store_productos(id) ON DELETE CASCADE,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, producto_id)
);

-- Crear tabla de estatus de pedidos
CREATE TABLE IF NOT EXISTS store_estatus_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  orden integer NOT NULL DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insertar estatus por defecto
INSERT INTO store_estatus_pedidos (nombre, orden) VALUES
  ('Pendiente', 1),
  ('En Proceso', 2),
  ('Enviado', 3),
  ('Entregado', 4)
ON CONFLICT (nombre) DO NOTHING;

-- Crear tabla de pedidos
CREATE TABLE IF NOT EXISTS store_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notas_usuario text,
  direccion_entrega text,
  estatus_id uuid REFERENCES store_estatus_pedidos(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de detalle de pedidos
CREATE TABLE IF NOT EXISTS store_pedidos_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES store_pedidos(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES store_productos(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(10,2) NOT NULL CHECK (precio_unitario >= 0)
);

-- Crear tabla de notas internas
CREATE TABLE IF NOT EXISTS store_pedidos_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES store_pedidos(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nota text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de historial de estatus
CREATE TABLE IF NOT EXISTS store_pedidos_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES store_pedidos(id) ON DELETE CASCADE,
  estatus_id uuid REFERENCES store_estatus_pedidos(id) ON DELETE RESTRICT,
  cambiado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_store_productos_categoria ON store_productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_store_carrito_usuario ON store_carrito(usuario_id);
CREATE INDEX IF NOT EXISTS idx_store_pedidos_usuario ON store_pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_store_pedidos_estatus ON store_pedidos(estatus_id);
CREATE INDEX IF NOT EXISTS idx_store_pedidos_detalle_pedido ON store_pedidos_detalle(pedido_id);
CREATE INDEX IF NOT EXISTS idx_store_pedidos_notas_pedido ON store_pedidos_notas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_store_pedidos_historial_pedido ON store_pedidos_historial(pedido_id);

-- Enable RLS
ALTER TABLE store_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_carrito ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_estatus_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_pedidos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_pedidos_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_pedidos_historial ENABLE ROW LEVEL SECURITY;

-- Políticas para store_categorias
CREATE POLICY "Todos pueden ver categorías activas"
  ON store_categorias FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admins pueden ver todas las categorías"
  ON store_categorias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden crear categorías"
  ON store_categorias FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden actualizar categorías"
  ON store_categorias FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden eliminar categorías"
  ON store_categorias FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para store_productos
CREATE POLICY "Todos pueden ver productos activos"
  ON store_productos FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admins pueden ver todos los productos"
  ON store_productos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden crear productos"
  ON store_productos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden actualizar productos"
  ON store_productos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden eliminar productos"
  ON store_productos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para store_carrito
CREATE POLICY "Usuarios pueden ver su carrito"
  ON store_carrito FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden agregar a su carrito"
  ON store_carrito FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden actualizar su carrito"
  ON store_carrito FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Usuarios pueden eliminar de su carrito"
  ON store_carrito FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid());

-- Políticas para store_estatus_pedidos
CREATE POLICY "Todos pueden ver estatus activos"
  ON store_estatus_pedidos FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Admins pueden gestionar estatus"
  ON store_estatus_pedidos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para store_pedidos
CREATE POLICY "Usuarios pueden ver sus pedidos"
  ON store_pedidos FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Admins pueden ver todos los pedidos"
  ON store_pedidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Usuarios pueden crear pedidos"
  ON store_pedidos FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Admins pueden actualizar pedidos"
  ON store_pedidos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para store_pedidos_detalle
CREATE POLICY "Usuarios pueden ver detalle de sus pedidos"
  ON store_pedidos_detalle FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM store_pedidos
      WHERE store_pedidos.id = pedido_id
      AND store_pedidos.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins pueden ver todo el detalle"
  ON store_pedidos_detalle FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Usuarios pueden agregar detalle al crear pedido"
  ON store_pedidos_detalle FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_pedidos
      WHERE store_pedidos.id = pedido_id
      AND store_pedidos.usuario_id = auth.uid()
    )
  );

-- Políticas para store_pedidos_notas
CREATE POLICY "Usuarios pueden ver notas de sus pedidos"
  ON store_pedidos_notas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM store_pedidos
      WHERE store_pedidos.id = pedido_id
      AND store_pedidos.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins pueden ver todas las notas"
  ON store_pedidos_notas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden crear notas"
  ON store_pedidos_notas FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para store_pedidos_historial
CREATE POLICY "Usuarios pueden ver historial de sus pedidos"
  ON store_pedidos_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM store_pedidos
      WHERE store_pedidos.id = pedido_id
      AND store_pedidos.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins pueden ver todo el historial"
  ON store_pedidos_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Admins pueden agregar historial"
  ON store_pedidos_historial FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Crear función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_store_pedidos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para updated_at
CREATE TRIGGER update_store_pedidos_timestamp
  BEFORE UPDATE ON store_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION update_store_pedidos_updated_at();
