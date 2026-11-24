/*
  # Fix GMM Folio Race Condition

  1. Changes
    - Add advisory lock to prevent concurrent folio generation
    - Ensures folio uniqueness even under high concurrency
  
  2. Details
    - Uses pg_advisory_xact_lock to lock during transaction
    - Lock is automatically released when transaction completes
*/

CREATE OR REPLACE FUNCTION public.generate_gmm_folio()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  year_part text;
  sequence_num integer;
  new_folio text;
BEGIN
  -- Lock to prevent race conditions (lock ID: arbitrary large number)
  PERFORM pg_advisory_xact_lock(123456789);
  
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(folio FROM 10) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM gmm_quotations
  WHERE folio LIKE 'GMM-' || year_part || '-%'
  AND deleted_at IS NULL;
  
  new_folio := 'GMM-' || year_part || '-' || LPAD(sequence_num::text, 5, '0');
  
  RETURN new_folio;
END;
$function$;
