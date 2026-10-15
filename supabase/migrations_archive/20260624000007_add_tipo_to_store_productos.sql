-- Campo tipo para vincular productos a funciones especiales del sistema
ALTER TABLE store_productos
  ADD COLUMN IF NOT EXISTS tipo text;

-- Valores esperados: 'marketing_premium_mensual', 'marketing_premium_anual', NULL (normal)
