/*
  # Agregar 'reorganized' a source_type Constraint

  1. Changes
    - Permitir 'reorganized' como source_type válido
*/

ALTER TABLE commission_batches
DROP CONSTRAINT IF EXISTS commission_batches_source_type_check;

ALTER TABLE commission_batches
ADD CONSTRAINT commission_batches_source_type_check
CHECK (source_type = ANY (ARRAY['manual_upload'::text, 'excel_import'::text, 'api'::text, 'reorganized'::text]));
