-- Precio por variante de atributo (e.g. tote bag chica/mediana/grande)
ALTER TABLE store_producto_atributo_opciones
  ADD COLUMN IF NOT EXISTS precio numeric;
