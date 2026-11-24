/*
  # Fix Commission RLS - Simplify Select Policies

  1. Problem
    - Multiple SELECT policies on commission tables may be conflicting
    - Frontend cannot load nested joins properly
    
  2. Solution
    - Ensure simple, non-conflicting SELECT policies for all authenticated users
    - Keep admin policies for write operations only
    
  3. Security
    - All authenticated users can read commission data
    - Only admins can modify
*/

-- Drop existing conflicting SELECT policies
DROP POLICY IF EXISTS "All view offices" ON commission_offices;
DROP POLICY IF EXISTS "All view fiscal regimes" ON commission_fiscal_regimes;
DROP POLICY IF EXISTS "All view agents" ON commission_agents;
DROP POLICY IF EXISTS "All view rules" ON commission_business_rules;
DROP POLICY IF EXISTS "All view batches" ON commission_batches;
DROP POLICY IF EXISTS "All view details" ON commission_details;
DROP POLICY IF EXISTS "All view errors" ON commission_errors;

-- Create simple SELECT policies for all tables
CREATE POLICY "Authenticated users can view offices"
  ON commission_offices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view fiscal regimes"
  ON commission_fiscal_regimes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view agents"
  ON commission_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view rules"
  ON commission_business_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view batches"
  ON commission_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view details"
  ON commission_details FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view errors"
  ON commission_errors FOR SELECT
  TO authenticated
  USING (true);