CREATE TABLE store_pedido_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES store_pedidos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo TEXT NOT NULL,
  monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  comentario TEXT DEFAULT '',
  registrado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE store_pedido_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_pagos" ON store_pedido_pagos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_pagos" ON store_pedido_pagos FOR INSERT
  TO authenticated WITH CHECK (registrado_por = auth.uid());

CREATE POLICY "update_pagos" ON store_pedido_pagos FOR UPDATE
  TO authenticated USING (registrado_por = auth.uid());

CREATE POLICY "delete_pagos" ON store_pedido_pagos FOR DELETE
  TO authenticated USING (registrado_por = auth.uid());

CREATE INDEX idx_store_pedido_pagos_pedido_id ON store_pedido_pagos(pedido_id);