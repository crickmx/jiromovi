-- Attribute definitions per product (e.g. "Talla", "Color")
CREATE TABLE store_producto_atributos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES store_productos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Attribute options (e.g. "S", "M", "L" for Talla)
CREATE TABLE store_producto_atributo_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atributo_id uuid NOT NULL REFERENCES store_producto_atributos(id) ON DELETE CASCADE,
  valor text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Store selected attributes on cart items
ALTER TABLE store_carrito ADD COLUMN IF NOT EXISTS atributos_seleccionados jsonb DEFAULT '{}';

-- Store selected attributes on order details
ALTER TABLE store_pedidos_detalle ADD COLUMN IF NOT EXISTS atributos_seleccionados jsonb DEFAULT '{}';

-- RLS
ALTER TABLE store_producto_atributos ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_producto_atributo_opciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_atributos" ON store_producto_atributos FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_atributos" ON store_producto_atributos FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_atributos" ON store_producto_atributos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_atributos" ON store_producto_atributos FOR DELETE
  TO authenticated USING (true);

CREATE POLICY "select_opciones" ON store_producto_atributo_opciones FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_opciones" ON store_producto_atributo_opciones FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_opciones" ON store_producto_atributo_opciones FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_opciones" ON store_producto_atributo_opciones FOR DELETE
  TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_store_producto_atributos_producto ON store_producto_atributos(producto_id);
CREATE INDEX idx_store_producto_atributo_opciones_atributo ON store_producto_atributo_opciones(atributo_id);
