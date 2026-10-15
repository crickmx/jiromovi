/*
  # MOVI Store - Sistema de Costos, Gastos, Metas y Analisis de Rentabilidad

  1. Modified Tables
    - `store_productos`: Add costo_base column for product acquisition cost
    - `store_pedidos`: Add revisado_por, cobrado, cobrado_en, cobrado_por fields
    - `store_pedidos_detalle`: Add costo_unitario_override for per-order cost adjustments

  2. New Tables
    - `store_producto_costos_extras` - Fixed extra costs per product (packaging, commission, etc.)
    - `store_pedido_gastos` - General expenses for an entire order
    - `store_pedido_detalle_gastos` - Expenses per line item in an order
    - `store_gastos_generales` - Global business expenses not tied to a specific order
    - `store_metas_utilidad` - Profit goals/targets by period

  3. Security
    - All new tables have RLS enabled
    - Only admins can manage costs, expenses, and goals
    - Regular users cannot see cost/expense information
*/

-- 1. Add cost fields to store_productos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_productos' AND column_name = 'costo_base'
  ) THEN
    ALTER TABLE store_productos ADD COLUMN costo_base numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- 2. Add review/payment tracking to store_pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_pedidos' AND column_name = 'revisado_por'
  ) THEN
    ALTER TABLE store_pedidos ADD COLUMN revisado_por text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_pedidos' AND column_name = 'cobrado'
  ) THEN
    ALTER TABLE store_pedidos ADD COLUMN cobrado boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_pedidos' AND column_name = 'cobrado_en'
  ) THEN
    ALTER TABLE store_pedidos ADD COLUMN cobrado_en timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_pedidos' AND column_name = 'cobrado_por'
  ) THEN
    ALTER TABLE store_pedidos ADD COLUMN cobrado_por uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- 3. Add cost override to store_pedidos_detalle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_pedidos_detalle' AND column_name = 'costo_unitario_override'
  ) THEN
    ALTER TABLE store_pedidos_detalle ADD COLUMN costo_unitario_override numeric(10,2);
  END IF;
END $$;

-- 4. Product extra costs (fixed costs that always apply)
CREATE TABLE IF NOT EXISTS store_producto_costos_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES store_productos(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  tipo text NOT NULL DEFAULT 'otro',
  descripcion text,
  monto numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_producto_costos_extras_producto ON store_producto_costos_extras(producto_id);

ALTER TABLE store_producto_costos_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage product extra costs"
  ON store_producto_costos_extras FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 5. Order-level expenses (gastos generales del pedido)
CREATE TABLE IF NOT EXISTS store_pedido_gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES store_pedidos(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  tipo text NOT NULL DEFAULT 'otro',
  descripcion text,
  monto numeric(10,2) NOT NULL DEFAULT 0,
  creado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_pedido_gastos_pedido ON store_pedido_gastos(pedido_id);

ALTER TABLE store_pedido_gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order expenses"
  ON store_pedido_gastos FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 6. Line-item expenses (gastos por producto en un pedido)
CREATE TABLE IF NOT EXISTS store_pedido_detalle_gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detalle_id uuid NOT NULL REFERENCES store_pedidos_detalle(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  tipo text NOT NULL DEFAULT 'otro',
  descripcion text,
  monto numeric(10,2) NOT NULL DEFAULT 0,
  creado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_pedido_detalle_gastos_detalle ON store_pedido_detalle_gastos(detalle_id);

ALTER TABLE store_pedido_detalle_gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage line item expenses"
  ON store_pedido_detalle_gastos FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 7. Global business expenses (not tied to any specific order)
CREATE TABLE IF NOT EXISTS store_gastos_generales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto text NOT NULL,
  tipo text NOT NULL DEFAULT 'otro',
  descripcion text,
  monto numeric(10,2) NOT NULL DEFAULT 0,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  creado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_gastos_generales_fecha ON store_gastos_generales(fecha);

ALTER TABLE store_gastos_generales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage global expenses"
  ON store_gastos_generales FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );

-- 8. Profit goals/targets
CREATE TABLE IF NOT EXISTS store_metas_utilidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  monto_objetivo numeric(12,2) NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  activa boolean DEFAULT true,
  creado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_metas_utilidad_fechas ON store_metas_utilidad(fecha_inicio, fecha_fin);

ALTER TABLE store_metas_utilidad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage profit goals"
  ON store_metas_utilidad FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin')
  );