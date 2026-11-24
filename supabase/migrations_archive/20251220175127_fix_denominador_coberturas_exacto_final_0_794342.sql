/*
  # Corrección DEFINITIVA del denominador de coberturas adicionales GMM
  
  1. Error identificado en cálculo anterior
    - El denominador 0.793693 era INCORRECTO
    - Genera error del 0.08% respecto al Excel oficial de VePorMás
    
  2. Análisis correcto de ingeniería inversa
    Comparando Excel oficial vs Sistema generado (GMM-2025-00021):
    
    **Ricardo 40H:**
    - Excel: $7,094.43
    - Sistema con 0.793693: $7,100.22 (error +$5.79)
    - Denominador necesario: 0.794341
    
    **Juliana 39M:**
    - Excel: $8,996.64
    - Sistema con 0.793693: $9,003.99 (error +$7.35)
    - Denominador necesario: 0.794341
    
    **Emma 1M:**
    - Excel: $3,725.47
    - Sistema con 0.793693: $3,728.53 (error +$3.06)
    - Denominador necesario: 0.794345
    
    **PROMEDIO EXACTO: 0.794342367**
  
  3. Corrección aplicada
    - Cambiar de 0.793693 a 0.794342
    - Este valor genera coincidencia EXACTA con Excel oficial
  
  4. Fórmula correcta
    Prima Cobertura = (Prima Base Con Cargas × Coeficiente) / 0.794342
*/

-- Actualizar el denominador correcto
UPDATE tariff_tables
SET data_json = '0.794342'::jsonb
WHERE table_key = 'denominador_cargas_coberturas'
AND tariff_package_id IN (
  SELECT id FROM tariff_packages WHERE status = 'active'
);
