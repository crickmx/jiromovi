/*
  # Fix Production RLS Complete - All Operations

  1. Changes
    - Replace individual policies with FOR ALL policies for service role
    - Ensures edge functions can perform all CRUD operations
    
  2. Security
    - Service role has full access (for edge functions only)
    - Regular authenticated users still need Admin role
*/

-- Drop existing service role policies to avoid conflicts
DROP POLICY IF EXISTS "Service role can insert regions" ON production_regions;
DROP POLICY IF EXISTS "Service role can select regions" ON production_regions;
DROP POLICY IF EXISTS "Service role can insert offices" ON production_offices;
DROP POLICY IF EXISTS "Service role can select offices" ON production_offices;
DROP POLICY IF EXISTS "Service role can insert managements" ON production_managements;
DROP POLICY IF EXISTS "Service role can select managements" ON production_managements;
DROP POLICY IF EXISTS "Service role can insert production records" ON production_records;
DROP POLICY IF EXISTS "Service role can select production records" ON production_records;
DROP POLICY IF EXISTS "Service role can delete production records" ON production_records;
DROP POLICY IF EXISTS "Service role can insert import logs" ON production_import_logs;
DROP POLICY IF EXISTS "Service role can select import logs" ON production_import_logs;

-- Create comprehensive policies for service role (all operations)
CREATE POLICY "Service role manages regions"
  ON production_regions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages offices"
  ON production_offices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages managements"
  ON production_managements FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages production records"
  ON production_records FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages import logs"
  ON production_import_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);