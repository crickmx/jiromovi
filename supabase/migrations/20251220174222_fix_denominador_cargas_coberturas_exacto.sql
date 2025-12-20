/*
  # Corrección del denominador de cargas para coberturas adicionales - Valor Exacto

  ## Análisis
  Mediante ingeniería inversa del Excel oficial de VePorMás, se determinó que
  el denominador exacto es 0.793693 (no 0.794).

  ## Validación con 3 casos del Excel:
  - Ricardo (40H, Querétaro): denominador = 0.793693 ✓
  - Juliana (39M, Querétaro): denominador = 0.793692 ✓  
  - Emma (1M, Querétaro): denominador = 0.793693 ✓
  
  Promedio: 0.793693 (consistencia perfecta)

  ## Fórmula
  Prima Cobertura = (Prima Base Con Cargas × Coeficiente) / 0.793693

  ## Cambios
  - Actualiza denominador_cargas_coberturas de 0.794 a 0.793693
*/

UPDATE tariff_tables
SET data_json = '0.793693'::jsonb
WHERE table_key = 'denominador_cargas_coberturas'
AND tariff_package_id IN (
  SELECT id FROM tariff_packages WHERE status = 'active'
);
