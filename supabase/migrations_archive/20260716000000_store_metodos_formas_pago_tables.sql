-- Métodos de Pago de la Orden de Compra (Store), antes hardcodeado como MetodoPagoOC
CREATE TABLE store_metodos_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Formas de Pago de la Orden de Compra, expresadas como cantidad + frecuencia (ej. 3 Mensual, 5 Quincenal, 12 OP)
CREATE TABLE store_formas_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cantidad integer NOT NULL,
  frecuencia text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Combinaciones válidas Método -> Forma. Vacía a propósito: se define desde Supabase, sin seed.
CREATE TABLE store_metodo_forma_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metodo_id uuid NOT NULL REFERENCES store_metodos_pago(id) ON DELETE CASCADE,
  forma_id uuid NOT NULL REFERENCES store_formas_pago(id) ON DELETE CASCADE,
  UNIQUE (metodo_id, forma_id)
);

ALTER TABLE store_metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_formas_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_metodo_forma_pago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_metodos_pago" ON store_metodos_pago FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_metodos_pago" ON store_metodos_pago FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_metodos_pago" ON store_metodos_pago FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_metodos_pago" ON store_metodos_pago FOR DELETE
  TO authenticated USING (true);

CREATE POLICY "select_formas_pago" ON store_formas_pago FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_formas_pago" ON store_formas_pago FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_formas_pago" ON store_formas_pago FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_formas_pago" ON store_formas_pago FOR DELETE
  TO authenticated USING (true);

CREATE POLICY "select_metodo_forma_pago" ON store_metodo_forma_pago FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_metodo_forma_pago" ON store_metodo_forma_pago FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_metodo_forma_pago" ON store_metodo_forma_pago FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_metodo_forma_pago" ON store_metodo_forma_pago FOR DELETE
  TO authenticated USING (true);

CREATE INDEX idx_store_metodo_forma_pago_metodo ON store_metodo_forma_pago(metodo_id);
CREATE INDEX idx_store_metodo_forma_pago_forma ON store_metodo_forma_pago(forma_id);

-- Seed: métodos existentes, mismo orden en que aparecían hardcodeados
INSERT INTO store_metodos_pago (nombre, orden) VALUES
  ('Cargo a Oficina', 1),
  ('Cargo a Bono de Agente', 2),
  ('Pago Directo', 3),
  ('Descuento de Comisiones', 4),
  ('Cargo a Nómina', 5),
  ('Otro', 6);

-- Seed: formas de pago iniciales (reemplazan a Contado/2 Parcialidades/12 Meses)
INSERT INTO store_formas_pago (cantidad, frecuencia, orden) VALUES
  (3, 'Mensual', 1),
  (5, 'Quincenal', 2),
  (12, 'OP', 3);
