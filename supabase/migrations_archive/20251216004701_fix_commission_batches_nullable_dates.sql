/*
  # Fix commission_batches: fechas nullable para lote "Sin fecha"

  1. Propósito
    - Permitir que date_from y date_to sean NULL
    - Esto es necesario para crear lotes "Sin fecha" cuando FPago está vacío
    - Los lotes convertidos de imports pueden tener filas sin fecha

  2. Cambios
    - ALTER date_from para que sea NULLABLE
    - ALTER date_to para que sea NULLABLE

  3. Justificación
    - Los archivos Excel pueden tener filas sin FPago
    - Estas filas deben agruparse en un lote "Sin fecha"
    - week_number = 0 identifica estos lotes especiales
*/

-- Hacer date_from NULLABLE en commission_batches
ALTER TABLE commission_batches
  ALTER COLUMN date_from DROP NOT NULL;

-- Hacer date_to NULLABLE en commission_batches
ALTER TABLE commission_batches
  ALTER COLUMN date_to DROP NOT NULL;

-- Comentarios para documentar
COMMENT ON COLUMN commission_batches.date_from IS 'Fecha inicio del periodo. NULL para lotes sin fecha definida (week_number = 0)';
COMMENT ON COLUMN commission_batches.date_to IS 'Fecha fin del periodo. NULL para lotes sin fecha definida (week_number = 0)';
COMMENT ON COLUMN commission_batches.week_number IS 'Número de semana ISO. 0 indica lote sin fecha';
