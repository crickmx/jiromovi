/*
  # Restore Proteccion Mutua and BX+ Fianzas — clear stale deleted_at

  These two records had a pre-existing deleted_at from a previous operation.
  They are canonical active records and should not be soft-deleted.
*/

UPDATE seguwallet_insurers
SET deleted_at = null, is_active = true, updated_at = now()
WHERE id IN (
  '059cf958-9293-43c6-959b-579c284c2021',  -- Proteccion Mutua
  '9fd3c4cf-3562-4386-ae51-7639e147e263'   -- BX+ Fianzas
);
