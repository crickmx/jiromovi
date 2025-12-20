/*
  # Agregar denominador de cargas para coberturas adicionales

  ## Descripción
  Las coberturas adicionales requieren su propio denominador de cargas (20.6%)
  diferente al de la prima base (44%). Este valor se deriva del análisis del
  Excel oficial de VePorMás donde se observa que las coberturas tienen un factor
  de 1.259 (= 1/0.794) sobre el cálculo base.

  ## Cambios
  - Inserta el valor `denominador_cargas_coberturas = 0.794` en tariff_tables
  - Se aplica al paquete de tarifas activo actual

  ## Fórmulas
  - Prima base: `primaBaseFinal / (1 - 0.44) = primaBaseFinal / 0.56`
  - Coberturas: `(primaBase * coef) / 0.794`
  - Factor entre Excel y sistema anterior: 1.259 = 1/0.794
*/

-- Insertar el denominador de cargas para coberturas adicionales en el paquete activo
INSERT INTO tariff_tables (tariff_package_id, table_key, data_json, row_count)
SELECT 
  id as tariff_package_id,
  'denominador_cargas_coberturas' as table_key,
  '0.794'::jsonb as data_json,
  1 as row_count
FROM tariff_packages
WHERE status = 'active'
ON CONFLICT (tariff_package_id, table_key) 
DO UPDATE SET 
  data_json = EXCLUDED.data_json,
  row_count = EXCLUDED.row_count;
