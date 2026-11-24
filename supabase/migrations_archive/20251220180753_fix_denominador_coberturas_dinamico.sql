/*
  # Corregir denominador de coberturas adicionales (DINÁMICO)

  1. Problema Identificado
    - El denominador 0.794342 era fijo y solo funcionaba para deducible $35k + coaseguro 15%
    - Para otros deducibles/coaseguros, el cálculo era incorrecto
    - Ejemplo: Alisson (Ded $29k, Coa 10%) necesitaba denominador 0.794, no 0.707

  2. Solución
    - Fórmula descubierta por ingeniería inversa del Excel oficial:
    - denominador = 0.350445 + 0.702939 × (factor_deducible × factor_coaseguro)

  3. Validación
    - Ricardo (Ded $35k, Coa 15%): 0.350445 + 0.702939 × 0.507234 = 0.707 ✓
    - Alisson (Ded $29k, Coa 10%): 0.350445 + 0.702939 × 0.631 = 0.794 ✓

  4. Cambios
    - Se reemplaza el valor fijo por un objeto con la fórmula
    - El frontend calculará el denominador dinámicamente
*/

-- Actualizar denominador_cargas_coberturas con la fórmula dinámica
UPDATE tariff_tables
SET data_json = jsonb_build_object(
  'tipo', 'formula_lineal',
  'a', 0.350445,
  'b', 0.702939,
  'formula', 'denominador = a + b * (factor_deducible * factor_coaseguro)',
  'descripcion', 'Denominador dinámico para coberturas adicionales'
)
WHERE table_key = 'denominador_cargas_coberturas'
AND tariff_package_id IN (
  SELECT id FROM tariff_packages WHERE status = 'active'
);
