/*
  # Agregar responsable de pago a pedidos de Store

  1. Modificaciones
    - Agregar columna `responsable_pago_id` a `store_pedidos`
      - Referencia a `usuarios(id)`
      - Nullable (opcional)
      - Con índice para mejor rendimiento
    
  2. Propósito
    - Permitir asignar un usuario responsable del pago del pedido
    - El usuario debe ser de la misma oficina que quien realiza el pedido
*/

-- Agregar columna responsable_pago_id
ALTER TABLE store_pedidos 
  ADD COLUMN IF NOT EXISTS responsable_pago_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;

-- Crear índice para mejorar rendimiento en consultas
CREATE INDEX IF NOT EXISTS idx_store_pedidos_responsable_pago 
  ON store_pedidos(responsable_pago_id);

-- Comentario en la columna
COMMENT ON COLUMN store_pedidos.responsable_pago_id IS 'Usuario responsable del pago del pedido';