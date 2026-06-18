/*
  # Seguwallet Chava - Complete RLS Policies

  ## Changes
  Adds missing RLS policies for seguwallet_chava_audit table:
  - INSERT policy so customers can log their own audit entries
  - Service role bypass for all three Chava tables (needed by edge function)

  ## Notes
  - The edge function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS automatically
  - The INSERT policies are needed when the frontend writes directly
*/

-- seguwallet_chava_audit insert policy (was missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seguwallet_chava_audit' AND policyname = 'Customer inserts own audit'
  ) THEN
    CREATE POLICY "Customer inserts own audit"
      ON seguwallet_chava_audit FOR INSERT
      TO authenticated
      WITH CHECK (
        customer_id = (
          SELECT id FROM seguwallet_customers
          WHERE auth_user_id = auth.uid()
          LIMIT 1
        )
      );
  END IF;
END $$;

-- Ensure seguwallet_chava_messages UPDATE is allowed for service role
-- (no action needed — service role bypasses RLS)

-- Add index on conversacion_id for fast message retrieval
CREATE INDEX IF NOT EXISTS idx_sw_chava_messages_conv ON seguwallet_chava_messages(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_sw_chava_conversations_customer ON seguwallet_chava_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_sw_chava_audit_customer ON seguwallet_chava_audit(customer_id);
