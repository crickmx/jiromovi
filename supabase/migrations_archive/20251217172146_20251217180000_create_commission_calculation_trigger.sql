/*
  # Trigger automático para cálculo de comisión

  1. Función de cálculo
    - Calcula `commission_bruta` automáticamente
    - Fórmula: commission_bruta = importe_base × (porcentaje_comision / 100)
    - Si falta algún valor, deja NULL (NO 0 silencioso)

  2. Trigger BEFORE INSERT/UPDATE
    - Se ejecuta automáticamente al insertar o actualizar
    - Garantiza consistencia de datos

  3. Backfill
    - Recalcula comisiones existentes usando la fórmula correcta
*/

-- Crear función de cálculo automático
CREATE OR REPLACE FUNCTION calculate_commission_bruta_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular commission_bruta solo si ambos valores existen
  IF NEW.importe_base IS NOT NULL AND NEW.porcentaje_comision IS NOT NULL THEN
    NEW.commission_bruta := ROUND((NEW.importe_base * NEW.porcentaje_comision / 100)::numeric, 2);
  ELSE
    -- Si falta algún valor, dejar NULL (NO poner 0)
    NEW.commission_bruta := NULL;
  END IF;

  -- Si commission_neta no está definida, copiarla de commission_bruta
  IF NEW.commission_neta IS NULL THEN
    NEW.commission_neta := NEW.commission_bruta;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS trigger_calculate_commission_bruta ON commission_details;

-- Crear trigger BEFORE INSERT/UPDATE
CREATE TRIGGER trigger_calculate_commission_bruta
  BEFORE INSERT OR UPDATE ON commission_details
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_bruta_trigger();

-- Backfill: Recalcular todas las comisiones existentes
UPDATE commission_details
SET commission_bruta = ROUND((importe_base * porcentaje_comision / 100)::numeric, 2)
WHERE importe_base IS NOT NULL
  AND porcentaje_comision IS NOT NULL;

-- Actualizar commission_neta para que coincida con commission_bruta si es NULL
UPDATE commission_details
SET commission_neta = commission_bruta
WHERE commission_neta IS NULL AND commission_bruta IS NOT NULL;

-- Agregar constraint de validación (opcional, pero recomendado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commission_details_calculation_check'
  ) THEN
    ALTER TABLE commission_details
      ADD CONSTRAINT commission_details_calculation_check
      CHECK (
        (importe_base IS NULL AND porcentaje_comision IS NULL AND commission_bruta IS NULL)
        OR
        (importe_base IS NOT NULL AND porcentaje_comision IS NOT NULL)
      );
  END IF;
END $$;
