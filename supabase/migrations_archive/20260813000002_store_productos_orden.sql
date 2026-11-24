-- Agrega campo orden a store_productos para controlar el orden de aparición en la tienda
ALTER TABLE store_productos ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;

-- Inicializa el orden basándose en created_at (más antiguo = orden menor = aparece primero)
UPDATE store_productos p
SET orden = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM store_productos
) sub
WHERE p.id = sub.id;
