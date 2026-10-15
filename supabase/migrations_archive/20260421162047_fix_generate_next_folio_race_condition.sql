/*
  # Fix race condition in generate_next_folio

  1. Problem
    - The previous `generate_next_folio()` released its advisory lock before
      the ticket row was inserted. Two concurrent requests could read the
      same MAX(folio) and both receive the same value, causing a duplicate
      key violation on `tickets_folio_key`.

  2. Solution
    - Create `ticket_folio_counters(year int PRIMARY KEY, last_number int)`
      as an atomic counter (one row per year).
    - Use `INSERT ... ON CONFLICT ... DO UPDATE SET last_number = last_number + 1 RETURNING last_number`
      so each call gets a unique, monotonically increasing number. No race
      condition is possible because Postgres row-level locks serialize the
      UPDATE.
    - On first call of a year, seed `last_number` from the current MAX(folio)
      in `tickets` to avoid collisions with any pre-existing folios.

  3. Security
    - Enable RLS on `ticket_folio_counters` with no user-facing policies;
      only the SECURITY DEFINER function touches this table.
*/

CREATE TABLE IF NOT EXISTS ticket_folio_counters (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ticket_folio_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION generate_next_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  seed_number integer := 0;
  next_number integer;
  new_folio text;
  existing_max text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ticket_folio_counters WHERE year = current_year) THEN
    SELECT folio INTO existing_max
    FROM tickets
    WHERE tipo_tramite = 'registro_actividad'
      AND folio LIKE 'RA-' || current_year || '-%'
    ORDER BY folio DESC
    LIMIT 1;

    IF existing_max IS NOT NULL THEN
      seed_number := COALESCE(
        CAST(SUBSTRING(existing_max FROM 'RA-[0-9]{4}-([0-9]+)') AS integer),
        0
      );
    END IF;

    INSERT INTO ticket_folio_counters (year, last_number)
    VALUES (current_year, seed_number)
    ON CONFLICT (year) DO NOTHING;
  END IF;

  UPDATE ticket_folio_counters
  SET last_number = last_number + 1,
      updated_at = now()
  WHERE year = current_year
  RETURNING last_number INTO next_number;

  new_folio := 'RA-' || current_year || '-' || LPAD(next_number::text, 4, '0');

  WHILE EXISTS (SELECT 1 FROM tickets WHERE folio = new_folio) LOOP
    UPDATE ticket_folio_counters
    SET last_number = last_number + 1,
        updated_at = now()
    WHERE year = current_year
    RETURNING last_number INTO next_number;

    new_folio := 'RA-' || current_year || '-' || LPAD(next_number::text, 4, '0');
  END LOOP;

  RETURN new_folio;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_next_folio() TO authenticated;

COMMENT ON FUNCTION generate_next_folio() IS 'Generates unique sequential folio numbers (RA-YYYY-NNNN) for registro_actividad tickets. Race-safe via ticket_folio_counters row-lock.';
