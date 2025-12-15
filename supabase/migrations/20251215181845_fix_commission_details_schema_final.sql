/*
  # Corrección Final de Esquema commission_details

  1. Propósito
    - Asegurar que todas las columnas necesarias existen en commission_details
    - NO agregar prima_neta porque ya existe (renombrada desde prima_base)
    - Verificar y agregar solo las columnas faltantes

  2. Columnas a Verificar/Agregar
    - business_rule_id: Referencia a la regla de negocio aplicada
    - porcentaje_base: Porcentaje base del Excel (PorPart) ANTES de reglas
    - tipo_calculo: Tipo de cálculo usado
    - nombre_asegurado: Nombre del asegurado

  3. Nota
    - prima_neta ya existe (fue renombrada de prima_base)
    - importe_base ya existe (agregada en migración anterior)
    - porcentaje_comision ya existe (agregada en migración anterior)
*/

-- Agregar business_rule_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'business_rule_id'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN business_rule_id uuid REFERENCES commission_business_rules(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_commission_details_business_rule 
    ON commission_details(business_rule_id);
  END IF;
END $$;

-- Agregar porcentaje_base si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'porcentaje_base'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN porcentaje_base double precision;
  END IF;
END $$;

-- Agregar tipo_calculo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'tipo_calculo'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN tipo_calculo text;
  END IF;
END $$;

-- Agregar nombre_asegurado si no existe (ya debería existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'nombre_asegurado'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN nombre_asegurado text;
    
    CREATE INDEX IF NOT EXISTS idx_commission_details_nombre_asegurado 
    ON commission_details(nombre_asegurado);
  END IF;
END $$;