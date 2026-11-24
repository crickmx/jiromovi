-- Reemplaza store_formas_pago/store_metodo_forma_pago: Parcialidades y Frecuencia
-- ahora son catalogos independientes, combinables 3 a 3 con Metodo de Pago.
DROP TABLE IF EXISTS store_metodo_forma_pago;
DROP TABLE IF EXISTS store_formas_pago;

CREATE TABLE store_parcialidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cantidad integer NOT NULL UNIQUE,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE store_frecuencias_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Combinaciones habilitadas Metodo + Parcialidad + Frecuencia. Vacia a proposito:
-- se llena desde el portal (StorePedidoDetalle.tsx).
CREATE TABLE store_metodo_pago_combinacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metodo_id uuid NOT NULL REFERENCES store_metodos_pago(id) ON DELETE CASCADE,
  parcialidad_id uuid NOT NULL REFERENCES store_parcialidades(id) ON DELETE CASCADE,
  frecuencia_id uuid NOT NULL REFERENCES store_frecuencias_pago(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metodo_id, parcialidad_id, frecuencia_id)
);

ALTER TABLE store_parcialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_frecuencias_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_metodo_pago_combinacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_parcialidades" ON store_parcialidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_parcialidades" ON store_parcialidades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_parcialidades" ON store_parcialidades FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_parcialidades" ON store_parcialidades FOR DELETE TO authenticated USING (true);

CREATE POLICY "select_frecuencias_pago" ON store_frecuencias_pago FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_frecuencias_pago" ON store_frecuencias_pago FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_frecuencias_pago" ON store_frecuencias_pago FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_frecuencias_pago" ON store_frecuencias_pago FOR DELETE TO authenticated USING (true);

CREATE POLICY "select_metodo_pago_combinacion" ON store_metodo_pago_combinacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_metodo_pago_combinacion" ON store_metodo_pago_combinacion FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_metodo_pago_combinacion" ON store_metodo_pago_combinacion FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_metodo_pago_combinacion" ON store_metodo_pago_combinacion FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_store_metodo_pago_combinacion_metodo ON store_metodo_pago_combinacion(metodo_id);

-- Seed: parcialidades y frecuencias del pedido de Ricardo
INSERT INTO store_parcialidades (cantidad, orden) VALUES
  (1, 1), (2, 2), (3, 3), (4, 4), (6, 5), (12, 6);

INSERT INTO store_frecuencias_pago (nombre, orden) VALUES
  ('Semanal', 1),
  ('Quincenal', 2),
  ('Mensual', 3),
  ('Bimestral', 4),
  ('Semestral', 5),
  ('Anual', 6),
  ('Contado', 7),
  ('Orden de Pago', 8);
