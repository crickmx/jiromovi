/*
  # Agregar columnas faltantes y cálculo automático de semanas
  
  ## Cambios
  1. Agregar importe_base a commission_items_staging
  2. Crear trigger para calcular week_number, week_year automáticamente
  
  ## Seguridad
  - No afecta RLS
*/

-- 1. Agregar columna importe_base si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_items_staging' AND column_name = 'importe_base'
  ) THEN
    ALTER TABLE commission_items_staging ADD COLUMN importe_base float DEFAULT 0;
  END IF;
END $$;

-- 2. Función para calcular semana ISO 8601
CREATE OR REPLACE FUNCTION calculate_iso_week_data(input_date date)
RETURNS TABLE (
  week_number int,
  week_year int,
  week_start_date date,
  week_end_date date
) AS $$
DECLARE
  week_num int;
  year_num int;
  start_date date;
  end_date date;
BEGIN
  -- Calcular semana ISO (1-53)
  week_num := EXTRACT(WEEK FROM input_date)::int;
  year_num := EXTRACT(YEAR FROM input_date)::int;
  
  -- Calcular inicio de semana (lunes)
  start_date := input_date - ((EXTRACT(DOW FROM input_date)::int + 6) % 7);
  
  -- Calcular fin de semana (domingo)
  end_date := start_date + 6;
  
  -- Ajustar año si la semana 1 pertenece al año anterior
  IF week_num >= 52 AND EXTRACT(MONTH FROM input_date) = 1 THEN
    year_num := year_num - 1;
  ELSIF week_num = 1 AND EXTRACT(MONTH FROM input_date) = 12 THEN
    year_num := year_num + 1;
  END IF;
  
  RETURN QUERY SELECT week_num, year_num, start_date, end_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Trigger para calcular datos de semana automáticamente
CREATE OR REPLACE FUNCTION auto_calculate_week_staging()
RETURNS TRIGGER AS $$
DECLARE
  week_data record;
BEGIN
  IF NEW.date_fpago IS NOT NULL THEN
    SELECT * INTO week_data FROM calculate_iso_week_data(NEW.date_fpago);
    
    NEW.week_number := week_data.week_number;
    NEW.week_year := week_data.week_year;
    NEW.week_start_date := week_data.week_start_date;
    NEW.week_end_date := week_data.week_end_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_week_before_insert ON commission_items_staging;
CREATE TRIGGER calculate_week_before_insert
  BEFORE INSERT OR UPDATE OF date_fpago
  ON commission_items_staging
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_week_staging();

-- 4. Actualizar items existentes sin week_number
UPDATE commission_items_staging
SET date_fpago = date_fpago  -- Force trigger execution
WHERE week_number IS NULL AND date_fpago IS NOT NULL;