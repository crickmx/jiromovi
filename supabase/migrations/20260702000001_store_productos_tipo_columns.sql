-- Columnas nuevas en store_productos
-- tipo: vinculación con sistema (ej. 'marketing_premium_mensual', 'marketing_premium_anual')
-- tipo_item: 'producto' | 'servicio'
-- disponibilidad: 'por_existencia' | 'por_pedido'

ALTER TABLE store_productos
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS tipo_item text NOT NULL DEFAULT 'producto',
  ADD COLUMN IF NOT EXISTS disponibilidad text NOT NULL DEFAULT 'por_existencia';
