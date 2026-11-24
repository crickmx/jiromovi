-- Agrega campo de personalización opcional por producto en la tienda
ALTER TABLE store_productos
  ADD COLUMN IF NOT EXISTS permite_personalizacion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS personalizacion_label    text    NOT NULL DEFAULT 'Personalización';
