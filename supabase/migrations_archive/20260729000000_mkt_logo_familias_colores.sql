-- Cada categoria de logo ahora elige que colores le aplican, en vez de
-- mostrar siempre los 10 colores globales (LOGO_COLORS) sin importar si
-- tienen sentido para esa categoria (ej. Jiro Fianzas no necesariamente
-- usa los mismos 10 que el logotipo principal).

ALTER TABLE mkt_logo_familias
  ADD COLUMN IF NOT EXISTS colores text[] NOT NULL DEFAULT '{}';

-- Preserva el comportamiento actual para las categorias que ya existian
-- antes de este cambio (mostraban los 10 colores).
UPDATE mkt_logo_familias
SET colores = ARRAY['navy','white','black','ink','cream','pale','yellow','mustard','green','sage']
WHERE key IN ('horizontal','vertical','isotype','wordmark','aniversario-50')
  AND colores = '{}';
