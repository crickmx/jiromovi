/*
  # Fix Production RLS for Edge Functions

  1. Changes
    - Add policies to allow service role (edge functions) to perform all operations
    - Service role needs to insert, select, and delete from production tables
    
  2. Security
    - Only service role can bypass checks
    - Regular authenticated users still need Admin role
*/

-- Allow service role to insert into production tables
CREATE POLICY "Service role can insert regions"
  ON production_regions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select regions"
  ON production_regions FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert offices"
  ON production_offices FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select offices"
  ON production_offices FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert managements"
  ON production_managements FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select managements"
  ON production_managements FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert production records"
  ON production_records FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select production records"
  ON production_records FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can delete production records"
  ON production_records FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert import logs"
  ON production_import_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select import logs"
  ON production_import_logs FOR SELECT
  TO service_role
  USING (true);