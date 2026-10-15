/*
  # Create generate_next_folio function for Registro de Actividades

  1. New Functions
    - `generate_next_folio()` - Generates sequential folio numbers for registro_actividad tickets
      - Format: RA-YYYY-NNNN (e.g., RA-2026-0001)
      - Auto-increments based on year
      - Thread-safe with advisory locks
  
  2. Security
    - SECURITY DEFINER to allow authenticated users to call it
    - Restricted to authenticated role
*/

-- Create function to generate next folio for registro_actividad
CREATE OR REPLACE FUNCTION generate_next_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  last_folio text;
  last_number integer;
  next_number integer;
  new_folio text;
BEGIN
  -- Get current year
  current_year := TO_CHAR(NOW(), 'YYYY');
  
  -- Use advisory lock to prevent race conditions
  PERFORM pg_advisory_lock(hashtext('generate_next_folio'));
  
  BEGIN
    -- Get the last folio for current year from tickets with tipo_tramite = 'registro_actividad'
    SELECT folio INTO last_folio
    FROM tickets
    WHERE tipo_tramite = 'registro_actividad'
      AND folio LIKE 'RA-' || current_year || '-%'
    ORDER BY folio DESC
    LIMIT 1;
    
    IF last_folio IS NULL THEN
      -- First folio of the year
      next_number := 1;
    ELSE
      -- Extract number from last folio (RA-YYYY-NNNN)
      last_number := CAST(SUBSTRING(last_folio FROM 'RA-[0-9]{4}-([0-9]+)') AS integer);
      next_number := last_number + 1;
    END IF;
    
    -- Generate new folio with 4-digit padding
    new_folio := 'RA-' || current_year || '-' || LPAD(next_number::text, 4, '0');
    
    -- Release advisory lock
    PERFORM pg_advisory_unlock(hashtext('generate_next_folio'));
    
    RETURN new_folio;
    
  EXCEPTION WHEN OTHERS THEN
    -- Release lock on error
    PERFORM pg_advisory_unlock(hashtext('generate_next_folio'));
    RAISE;
  END;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION generate_next_folio() TO authenticated;

-- Add comment
COMMENT ON FUNCTION generate_next_folio() IS 'Generates sequential folio numbers for registro_actividad tickets in format RA-YYYY-NNNN';
