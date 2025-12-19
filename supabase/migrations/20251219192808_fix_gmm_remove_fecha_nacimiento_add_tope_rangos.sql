/*
  # Fix GMM: Eliminar fecha_nacimiento y agregar rangos de tope de coaseguro

  ## Cambios

  1. **gmm_quote_insureds**:
     - Eliminar columna `fecha_nacimiento` (ya no se usa)
     - La edad ahora es la única fuente de verdad y es obligatoria

  2. **Validaciones**:
     - La edad es obligatoria y debe ser > 0

  ## Justificación

  - Se eliminó la lógica de cálculo de edad desde fecha_nacimiento
  - El sistema ahora usa exclusivamente la edad capturada manualmente
  - Esto simplifica el sistema y elimina inconsistencias
*/

-- Eliminar columna fecha_nacimiento de gmm_quote_insureds
ALTER TABLE gmm_quote_insureds
DROP COLUMN IF EXISTS fecha_nacimiento;

-- La tabla tariff_tables ya soporta data_json arbitrario
-- No necesitamos modificar el esquema, solo el contenido JSON
-- El parser de Excel se encargará de extraer tope_coaseguro_rangos
