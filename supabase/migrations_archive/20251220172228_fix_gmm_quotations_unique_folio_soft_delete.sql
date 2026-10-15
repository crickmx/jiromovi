/*
  # Fix GMM Quotations Folio Unique Constraint with Soft Delete

  1. Problem
    - UNIQUE constraint on folio doesn't consider deleted_at
    - Deleted quotations still block folio reuse
    - Causes duplicate key errors when trying to create new quotations

  2. Solution
    - Drop the existing UNIQUE constraint
    - Create a partial UNIQUE index that only applies to non-deleted records
    - This allows folio reuse for deleted records while maintaining uniqueness for active ones
*/

-- Drop the existing UNIQUE constraint
ALTER TABLE gmm_quotations 
DROP CONSTRAINT IF EXISTS gmm_quotations_folio_key;

-- Create a partial unique index that only applies to non-deleted records
CREATE UNIQUE INDEX gmm_quotations_folio_active_key 
ON gmm_quotations (folio) 
WHERE deleted_at IS NULL;
