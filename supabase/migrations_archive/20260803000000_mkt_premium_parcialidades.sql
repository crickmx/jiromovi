-- TKA5CD3: en /mercadotecnia/admin > Plan Premium no habia forma de indicar
-- en cuantas parcialidades diferir el cobro cuando el metodo de pago es
-- "Descuento a comisiones". El campo nunca existio (no es un bug de UI que
-- se rompio, es una funcionalidad que faltaba).

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_parcialidades integer
    CHECK (mkt_premium_parcialidades IS NULL OR mkt_premium_parcialidades BETWEEN 1 AND 12);
