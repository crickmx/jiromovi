/*
  # Fix Seguwallet customer self-access policies

  ## Summary
  1. Add UPDATE policy so Seguwallet customers can update their own last_login_at
  2. Ensure SELECT policy works correctly — the existing policy uses OR conditions
     where `auth_user_id = auth.uid()` is sufficient for customers to read themselves
     (get_movi_user_role returns NULL for non-MOVI users, which is fine since it's OR)
  3. Add explicit customer self-select policy that doesn't rely on get_movi_user_role
*/

-- Drop existing read policy and recreate to be explicit and safe
DROP POLICY IF EXISTS "seguwallet_customer_read_own" ON seguwallet_customers;

CREATE POLICY "seguwallet_customer_read_own"
  ON seguwallet_customers
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR get_movi_user_role(auth.uid()) = 'Administrador'
    OR (
      get_movi_user_role(auth.uid()) = ANY(ARRAY['Gerente','Agente','Empleado','Ejecutivo'])
      AND agent_user_id = auth.uid()
    )
  );

-- Add UPDATE policy for customers updating their own last_login_at
CREATE POLICY "seguwallet_customer_self_update_login"
  ON seguwallet_customers
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
