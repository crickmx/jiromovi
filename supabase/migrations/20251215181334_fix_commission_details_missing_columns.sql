/*
  # Corrección de Columnas Faltantes en commission_details

  1. Propósito
    - Agregar columnas faltantes que usa la edge function process-commissions
    - Alinear la estructura de la tabla con el código de procesamiento
    - Permitir almacenar información de reglas de negocio aplicadas

  2. Nuevas Columnas
    - business_rule_id: Referencia a la regla de negocio aplicada
    - porcentaje_base: Porcentaje base del Excel (PorPart)
    - porcentaje_comision: Porcentaje de comisión calculado/aplicado
    - tipo_calculo: Tipo de cálculo usado (directo, porcentaje_fijo, escalas, multiplicador)
    - importe_base: Importe base sobre el que se calculó la comisión
    - nombre_asegurado: Nombre del asegurado

  3. Cambios
    - Todas las columnas son opcionales (nullable)
    - business_rule_id tiene FK a commission_business_rules
*/

-- Agregar columnas faltantes a commission_details
DO $$
BEGIN
  -- Agregar business_rule_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'business_rule_id'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN business_rule_id uuid REFERENCES commission_business_rules(id) ON DELETE SET NULL;
  END IF;

  -- Agregar porcentaje_base
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'porcentaje_base'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN porcentaje_base float;
  END IF;

  -- Agregar porcentaje_comision
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'porcentaje_comision'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN porcentaje_comision float;
  END IF;

  -- Agregar tipo_calculo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'tipo_calculo'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN tipo_calculo text;
  END IF;

  -- Agregar importe_base
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'importe_base'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN importe_base float;
  END IF;

  -- Agregar nombre_asegurado
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'nombre_asegurado'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN nombre_asegurado text;
  END IF;

  -- Agregar prima_neta como alias de prima_base (por compatibilidad)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_details' AND column_name = 'prima_neta'
  ) THEN
    ALTER TABLE commission_details 
    ADD COLUMN prima_neta float;
  END IF;

END $$;

-- Crear índice para business_rule_id
CREATE INDEX IF NOT EXISTS idx_commission_details_business_rule 
ON commission_details(business_rule_id);

-- Crear índice para nombre_asegurado (búsquedas)
CREATE INDEX IF NOT EXISTS idx_commission_details_nombre_asegurado 
ON commission_details(nombre_asegurado);

-- Comentarios para documentación
COMMENT ON COLUMN commission_details.business_rule_id IS 'ID de la regla de negocio aplicada para calcular la comisión';
COMMENT ON COLUMN commission_details.porcentaje_base IS 'Porcentaje base original del Excel (campo PorPart)';
COMMENT ON COLUMN commission_details.porcentaje_comision IS 'Porcentaje de comisión calculado después de aplicar reglas';
COMMENT ON COLUMN commission_details.tipo_calculo IS 'Tipo de cálculo: directo, porcentaje_fijo, escalas, multiplicador';
COMMENT ON COLUMN commission_details.importe_base IS 'Importe base sobre el que se calculó la comisión';
COMMENT ON COLUMN commission_details.nombre_asegurado IS 'Nombre completo del asegurado';
COMMENT ON COLUMN commission_details.prima_neta IS 'Prima neta (alias de prima_base para compatibilidad con Excel)';