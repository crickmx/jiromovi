/*
  # Corregir lógica de cálculo de comisiones

  1. Cambios en `commission_details`
    - Renombra `prima_base` a `prima_neta` (solo informativo, NO afecta cálculo)
    - Agrega columna `importe_base` (base real para calcular comisión)
    - Agrega columna `porcentaje_comision` (PorPart del Excel)

  2. Lógica correcta
    - PrimaNeta = Prima (solo informativo)
    - Importe = Base de comisión
    - PorPart = % de comisión
    - Comisión = Importe * PorPart / 100

  3. Notas
    - La columna `prima_base` se renombra a `prima_neta` para claridad
    - El cálculo ahora usa `importe_base * porcentaje_comision / 100`
*/

-- Renombrar prima_base a prima_neta
ALTER TABLE commission_details 
  RENAME COLUMN prima_base TO prima_neta;

-- Agregar columna importe_base (base para calcular comisión)
ALTER TABLE commission_details 
  ADD COLUMN IF NOT EXISTS importe_base double precision;

-- Agregar columna porcentaje_comision (PorPart del Excel)
ALTER TABLE commission_details 
  ADD COLUMN IF NOT EXISTS porcentaje_comision double precision;

-- Para datos existentes, copiar prima_neta a importe_base si no existe
UPDATE commission_details 
SET importe_base = prima_neta 
WHERE importe_base IS NULL;

-- Para datos existentes, calcular porcentaje si no existe (retrocompatibilidad)
UPDATE commission_details 
SET porcentaje_comision = CASE 
  WHEN prima_neta > 0 THEN (commission_bruta / prima_neta * 100)
  ELSE 0 
END
WHERE porcentaje_comision IS NULL;

-- Hacer NOT NULL después de llenar datos existentes
ALTER TABLE commission_details 
  ALTER COLUMN importe_base SET NOT NULL;

ALTER TABLE commission_details 
  ALTER COLUMN porcentaje_comision SET NOT NULL;
