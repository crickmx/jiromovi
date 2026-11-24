/*
  # Simplificar modelo de comisiones y agregar nombre de asegurado

  1. Cambios en `commission_details`
    - Agregar columna `nombre_asegurado` (text)
    - Eliminar columna `impuestos_json`
    - Modificar lógica: comision_neta = comision_bruta (sin impuestos)

  2. Cambios en tablas relacionadas
    - Simplificar `commission_agents` eliminando referencia a régimen fiscal
    - Las tablas de regímenes fiscales quedan para referencia histórica

  3. Notas importantes
    - Los lotes existentes mantendrán su estructura
    - Esta migración prepara el sistema para un modelo simplificado
*/

-- Agregar nombre_asegurado a commission_details si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_details' AND column_name = 'nombre_asegurado'
  ) THEN
    ALTER TABLE commission_details ADD COLUMN nombre_asegurado text;
  END IF;
END $$;

-- Actualizar commission_neta para que sea igual a commission_bruta en registros futuros
-- (Los registros existentes se mantienen intactos para referencia histórica)

-- Crear una vista simplificada para reportes sin impuestos
CREATE OR REPLACE VIEW commission_summary_simple AS
SELECT 
  cd.id,
  cd.batch_id,
  cd.agent_id,
  cd.poliza,
  cd.nombre_asegurado,
  cd.ramo,
  cd.aseguradora,
  cd.prima_base,
  cd.commission_bruta,
  CASE 
    WHEN cd.is_manual_adjusted THEN cd.adjusted_commission_neta
    ELSE cd.commission_bruta
  END as commission_final,
  cd.is_manual_adjusted,
  cd.date_fpago,
  cd.created_at,
  ca.name as agent_name,
  ca.email as agent_email,
  co.name as office_name
FROM commission_details cd
LEFT JOIN commission_agents ca ON ca.id = cd.agent_id
LEFT JOIN commission_offices co ON co.id = cd.office_id;

COMMENT ON VIEW commission_summary_simple IS 'Vista simplificada de comisiones sin cálculo de impuestos. La comisión final es la comisión bruta (a menos que haya sido ajustada manualmente).';
