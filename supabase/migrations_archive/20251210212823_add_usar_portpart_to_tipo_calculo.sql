/*
  # Agregar tipo_calculo 'usar_portpart' a reglas de negocio

  1. Cambios
    - Actualizar constraint de tipo_calculo en commission_business_rules
    - Agregar opción 'usar_portpart' que toma el valor directamente de la columna PortPart del Excel

  2. Notas
    - Cuando tipo_calculo = 'usar_portpart', el sistema usará el valor de PortPart directamente
    - PortPart contiene el porcentaje de comisión ya calculado por la aseguradora
    - Esta es la forma más precisa de calcular comisiones cuando está disponible
*/

-- Eliminar el constraint existente y crear uno nuevo con 'usar_portpart'
DO $$
BEGIN
  -- Primero eliminamos el constraint existente si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'commission_business_rules_tipo_calculo_check'
  ) THEN
    ALTER TABLE commission_business_rules 
    DROP CONSTRAINT commission_business_rules_tipo_calculo_check;
  END IF;

  -- Agregar el nuevo constraint con la opción adicional
  ALTER TABLE commission_business_rules
  ADD CONSTRAINT commission_business_rules_tipo_calculo_check
  CHECK (tipo_calculo IN ('%_sobre_base', 'monto_fijo', '%_con_min_max', 'usar_portpart'));
END $$;
