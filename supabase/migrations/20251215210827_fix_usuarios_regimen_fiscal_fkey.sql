/*
  # Fix usuarios.regimen_fiscal_id Foreign Key

  1. Problem
    - usuarios.regimen_fiscal_id has NO ACTION constraint
    - This can prevent user deletion when they have a fiscal regime assigned
    
  2. Solution
    - Change to SET NULL to allow user deletion
    - Preserve fiscal regime records for other users
*/

-- Drop existing constraint
ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_regimen_fiscal_id_fkey;

-- Add new constraint with SET NULL
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_regimen_fiscal_id_fkey
  FOREIGN KEY (regimen_fiscal_id)
  REFERENCES commission_fiscal_regimes(id)
  ON DELETE SET NULL;
