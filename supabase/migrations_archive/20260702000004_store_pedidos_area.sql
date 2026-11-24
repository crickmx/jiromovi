-- Área/zona de entrega del pedido (oficina, zona, etc.)
ALTER TABLE store_pedidos
  ADD COLUMN IF NOT EXISTS area_entrega text;
