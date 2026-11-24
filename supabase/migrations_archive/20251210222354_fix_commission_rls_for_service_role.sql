/*
  # Fix Commission RLS for Service Role (Edge Functions)

  1. Changes
    - Add policies to allow service role (edge functions) to perform all operations
    - Service role needs to insert, select, update, and delete from commission tables
    
  2. Security
    - Only service role can bypass checks
    - Regular authenticated users still follow existing policies
*/

-- Allow service role to manage commission_offices
CREATE POLICY "Service role can manage offices"
  ON commission_offices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to manage commission_fiscal_regimes
CREATE POLICY "Service role can manage fiscal regimes"
  ON commission_fiscal_regimes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to manage commission_agents
CREATE POLICY "Service role can manage agents"
  ON commission_agents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to manage commission_business_rules
CREATE POLICY "Service role can manage rules"
  ON commission_business_rules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to manage commission_batches
CREATE POLICY "Service role can manage batches"
  ON commission_batches FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to manage commission_details
CREATE POLICY "Service role can manage details"
  ON commission_details FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to manage commission_errors
CREATE POLICY "Service role can manage errors"
  ON commission_errors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);