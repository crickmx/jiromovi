/*
  # Add tipo_item and disponibilidad to store_productos

  1. Changes
    - Add tipo_item column: 'producto' or 'servicio'
    - Add disponibilidad column: 'por_existencia' or 'por_pedido'
    - Services default to 'por_pedido' (no stock tracking)
    - Existing products default to 'por_existencia' (current behavior)

  2. Logic
    - tipo_item = 'servicio' → disponibilidad must be 'por_pedido'
    - tipo_item = 'producto' → disponibilidad can be either
    - When disponibilidad = 'por_pedido', stock is irrelevant (always available)
*/

ALTER TABLE store_productos
  ADD COLUMN tipo_item text NOT NULL DEFAULT 'producto',
  ADD COLUMN disponibilidad text NOT NULL DEFAULT 'por_existencia';

-- Add check constraints
ALTER TABLE store_productos
  ADD CONSTRAINT store_productos_tipo_item_check
    CHECK (tipo_item IN ('producto', 'servicio'));

ALTER TABLE store_productos
  ADD CONSTRAINT store_productos_disponibilidad_check
    CHECK (disponibilidad IN ('por_existencia', 'por_pedido'));

-- Add constraint: services must be 'por_pedido'
ALTER TABLE store_productos
  ADD CONSTRAINT store_productos_servicio_must_be_por_pedido
    CHECK (tipo_item != 'servicio' OR disponibilidad = 'por_pedido');

-- Update existing "Servicios" category products to tipo_item = 'servicio'
UPDATE store_productos
SET tipo_item = 'servicio', disponibilidad = 'por_pedido'
WHERE categoria_id IN (
  SELECT id FROM store_categorias WHERE lower(nombre) = 'servicios'
);
