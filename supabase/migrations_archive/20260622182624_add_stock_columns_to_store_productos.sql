ALTER TABLE store_productos
  ADD COLUMN stock integer NOT NULL DEFAULT 0,
  ADD COLUMN stock_umbral integer NOT NULL DEFAULT 5;
