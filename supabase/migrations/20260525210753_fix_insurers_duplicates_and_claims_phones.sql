
/*
  # Fix seguwallet_insurers: remove duplicates and populate claims_phone

  ## Problems fixed
  1. Duplicate rows caused by migration running INSERT twice (first run inserted
     data before failing on policies, second run inserted again).
     Strategy: keep the row with the LOWER ctid (first inserted) per name, 
     soft-delete the others.
  2. claims_phone was NULL for all rows because the seed did not include it.
     We populate it from customer_service_phone so siniestros modal shows results.

  ## Changes
  - Soft-delete duplicate rows (keep one per name)
  - Set claims_phone = customer_service_phone where claims_phone IS NULL
*/

-- Step 1: soft-delete duplicates — keep the row with the smallest ctid per name
UPDATE seguwallet_insurers
SET deleted_at = now()
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) AS rn
    FROM seguwallet_insurers
    WHERE deleted_at IS NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: populate claims_phone from customer_service_phone where missing
UPDATE seguwallet_insurers
SET claims_phone = customer_service_phone
WHERE claims_phone IS NULL
  AND customer_service_phone IS NOT NULL
  AND deleted_at IS NULL;
