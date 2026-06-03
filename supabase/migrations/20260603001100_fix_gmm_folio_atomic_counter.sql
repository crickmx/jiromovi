/*
  # Fix GMM quotation folio race condition

  ## Problem
  The current generate_gmm_folio() uses MAX(folio) to find the next sequence number,
  which causes duplicate key violations under concurrent saves because two sessions
  can read the same MAX and generate the same folio.

  ## Solution
  1. Create a gmm_folio_counters table to track per-year sequence atomically
  2. Replace generate_gmm_folio() with an atomic counter-based implementation
     using INSERT ... ON CONFLICT ... DO UPDATE (same pattern as ticket_folio_counters)
  3. Seeds the counter from existing MAX folio on first call per year

  ## Tables Modified
  - NEW: gmm_folio_counters (year int, last_sequence int)
  - UPDATED: generate_gmm_folio() function
*/

-- Atomic counter table for GMM folios
CREATE TABLE IF NOT EXISTS gmm_folio_counters (
  year        int  PRIMARY KEY,
  last_seq    int  NOT NULL DEFAULT 0
);

ALTER TABLE gmm_folio_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access gmm_folio_counters"
  ON gmm_folio_counters FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read gmm_folio_counters"
  ON gmm_folio_counters FOR SELECT TO authenticated USING (true);

-- Seed the counter from existing data so we don't reuse old folios
INSERT INTO gmm_folio_counters (year, last_seq)
SELECT
  EXTRACT(YEAR FROM created_at)::int AS year,
  MAX(
    CASE
      WHEN folio ~ '^GMM-[0-9]{4}-[0-9]+$'
      THEN split_part(folio, '-', 3)::int
      ELSE 0
    END
  ) AS last_seq
FROM gmm_quotations
GROUP BY EXTRACT(YEAR FROM created_at)::int
ON CONFLICT (year) DO UPDATE SET last_seq = GREATEST(gmm_folio_counters.last_seq, EXCLUDED.last_seq);

-- Drop old function and trigger, recreate atomically
DROP TRIGGER IF EXISTS trigger_set_gmm_folio ON gmm_quotations;
DROP FUNCTION IF EXISTS set_gmm_folio();
DROP FUNCTION IF EXISTS generate_gmm_folio();

CREATE OR REPLACE FUNCTION generate_gmm_folio()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year  int  := EXTRACT(YEAR FROM now())::int;
  v_seq   int;
BEGIN
  INSERT INTO gmm_folio_counters (year, last_seq)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_seq = gmm_folio_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'GMM-' || v_year || '-' || lpad(v_seq::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION set_gmm_folio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folio IS NULL OR NEW.folio = '' THEN
    NEW.folio := generate_gmm_folio();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_gmm_folio
  BEFORE INSERT ON gmm_quotations
  FOR EACH ROW EXECUTE FUNCTION set_gmm_folio();
