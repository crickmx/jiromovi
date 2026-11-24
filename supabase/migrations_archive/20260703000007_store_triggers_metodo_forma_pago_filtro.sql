-- Permite condicionar un trigger Store -> Tramites no solo al estatus destino,
-- sino tambien al metodo/forma de pago del pedido (ej. "Descuento de Comisiones"
-- dispara el tipo A, "Cargo a Bono de Agente" dispara el tipo B). NULL = cualquiera.
ALTER TABLE store_tramite_triggers
  ADD COLUMN IF NOT EXISTS metodo_pago_filtro text,
  ADD COLUMN IF NOT EXISTS forma_pago_filtro text;
