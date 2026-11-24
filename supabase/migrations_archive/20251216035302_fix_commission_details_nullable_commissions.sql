/*
  # Fix commission_details: Hacer commission_bruta y commission_neta nullable

  1. Propósito
    - Permitir inserción de items sin comisiones calculadas
    - Los datos del Excel se insertan "crudos" primero
    - El cálculo de comisiones se hace después

  2. Cambios
    - commission_bruta: NOT NULL -> NULLABLE
    - commission_neta: NOT NULL -> NULLABLE
    - Agregar defaults de 0 para items existentes

  3. Justificación
    - La edge function convert-import-to-commission-batches inserta datos sin calcular
    - Las comisiones se calculan en un paso posterior
    - Esto permite separar la ingesta de datos del cálculo de comisiones
*/

-- Hacer commission_bruta nullable
ALTER TABLE commission_details
  ALTER COLUMN commission_bruta DROP NOT NULL;

-- Hacer commission_neta nullable
ALTER TABLE commission_details
  ALTER COLUMN commission_neta DROP NOT NULL;

-- Actualizar valores NULL existentes a 0 (si los hay)
UPDATE commission_details
SET commission_bruta = 0
WHERE commission_bruta IS NULL;

UPDATE commission_details
SET commission_neta = 0
WHERE commission_neta IS NULL;

-- Comentarios
COMMENT ON COLUMN commission_details.commission_bruta IS 'Comisión bruta calculada. NULL si aún no se ha calculado';
COMMENT ON COLUMN commission_details.commission_neta IS 'Comisión neta calculada. NULL si aún no se ha calculado';
