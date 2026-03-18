/*
  # Estandarizar nombres de regímenes fiscales a MAYÚSCULAS

  1. Problema detectado
     - Los regímenes fiscales están guardados con mayúscula inicial: "Honorarios", "Asimilados"
     - Las funciones SQL comparan con MAYÚSCULAS: "HONORARIOS", "ASIMILADOS"
     - Esto causa que algunos usuarios se les asigne el régimen incorrecto

  2. Solución
     - Estandarizar todos los nombres a MAYÚSCULAS
     - Esto asegura que las comparaciones en SQL siempre funcionen correctamente
*/

-- Actualizar los nombres de los regímenes fiscales a MAYÚSCULAS
UPDATE commission_fiscal_regimes
SET name = UPPER(name)
WHERE name != UPPER(name);

-- Verificar que existan los tres regímenes principales
INSERT INTO commission_fiscal_regimes (name, iva_trasladado, iva_retenido, isr, valid_from) VALUES
  ('HONORARIOS', 0.16, 0.1067, 0.10, '2024-01-01'),
  ('RESICO', 0.16, 0.00, 0.0125, '2024-01-01'),
  ('ASIMILADOS', 0.00, 0.00, 0.10, '2024-01-01')
ON CONFLICT (name) DO UPDATE SET
  iva_trasladado = EXCLUDED.iva_trasladado,
  iva_retenido = EXCLUDED.iva_retenido,
  isr = EXCLUDED.isr;

COMMENT ON TABLE commission_fiscal_regimes IS
'Tabla de regímenes fiscales. Los nombres deben estar en MAYÚSCULAS para consistencia con las funciones SQL.';