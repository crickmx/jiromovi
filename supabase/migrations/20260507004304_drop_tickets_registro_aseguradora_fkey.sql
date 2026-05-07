/*
  # Drop incorrect FK on tickets.registro_aseguradora

  1. Problem
    - `tickets.registro_aseguradora` has a foreign key to `cat_aseguradoras.nombre`
    - This field stores a user-friendly insurer name (e.g. "Qualitas") that may
      not match the exact catalog entry ("QUALITAS COMPAÑIA DE SEGUROS S.A. DE C.V.")
    - The proper insurer linkage is already done via `tickets.insurers` (UUID array)
      referencing the `aseguradoras` table

  2. Fix
    - Drop the foreign key constraint `tickets_registro_aseguradora_fkey`
    - The column remains as a free-text descriptive field
*/

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_registro_aseguradora_fkey;
