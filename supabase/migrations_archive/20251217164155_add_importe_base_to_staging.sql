/*
  # Agregar campo importe_base a staging para separar Importe de PrimaNeta

  1. Cambios en Tablas
    - commission_items_staging:
      - Agregar columna `importe_base` (double precision, NOT NULL, default 0)
      - Renombrar conceptualmente `prima_neta` como campo informativo
      - Agregar índice en importe_base para queries

    - commission_details:
      - Verificar que tenga `importe_base` (ya debe existir)

  2. Data Migration
    - Copiar prima_neta existente a importe_base (para datos históricos)
    - Los nuevos datos deberán guardar ambos campos por separado

  3. Comentarios
    - Documentar que importe_base es la BASE de cálculo de comisión
    - Documentar que prima_neta es solo informativo
*/

-- 1. Agregar campo importe_base a staging
ALTER TABLE commission_items_staging
ADD COLUMN IF NOT EXISTS importe_base double precision NOT NULL DEFAULT 0;

-- 2. Copiar datos existentes (prima_neta → importe_base para datos históricos)
-- Solo si importe_base está en 0 y prima_neta tiene valor
UPDATE commission_items_staging
SET importe_base = prima_neta
WHERE importe_base = 0 AND prima_neta > 0;

-- 3. Agregar comentarios explicativos
COMMENT ON COLUMN commission_items_staging.importe_base IS 
  'BASE DE COMISIÓN: Monto sobre el cual se calcula la comisión (columna Importe del Excel). 
   Fórmula: Comisión = importe_base × (porcentaje_base / 100)';

COMMENT ON COLUMN commission_items_staging.prima_neta IS 
  'SOLO INFORMATIVO: Prima neta de la póliza (no se usa para calcular comisión).
   Este valor puede ser diferente de importe_base.';

-- 4. Crear índice para queries por importe_base
CREATE INDEX IF NOT EXISTS idx_staging_importe_base 
  ON commission_items_staging(importe_base) 
  WHERE importe_base > 0;

-- 5. Verificar que commission_details también tenga los campos correctos
DO $$
BEGIN
  -- Verificar importe_base existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'importe_base'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN importe_base double precision NOT NULL DEFAULT 0;
  END IF;

  -- Agregar comentarios a commission_details también
  EXECUTE 'COMMENT ON COLUMN commission_details.importe_base IS ' ||
    quote_literal('BASE DE COMISIÓN: Monto sobre el cual se calcula la comisión (columna Importe del Excel). Fórmula: Comisión = importe_base × (porcentaje_comision / 100)');

  EXECUTE 'COMMENT ON COLUMN commission_details.prima_neta IS ' ||
    quote_literal('SOLO INFORMATIVO: Prima neta de la póliza (no se usa para calcular comisión). Este valor puede ser diferente de importe_base.');
END $$;
