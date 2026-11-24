/*
  # Agent-scoped Seguwallet customer policies

  ## Summary
  Extends the existing RLS on `seguwallet_customers` and `seguwallet_customer_sicas_clients`
  so that agents (rol = 'Agente') can:
    - SELECT their own customers (agent_user_id = auth.uid())
    - INSERT new customers assigned to themselves
    - UPDATE their own customers (name, phone, status)
  
  Admins, Gerentes and Ejecutivos retain full access via the existing service-role or
  the "admin reads all" policy already in place.

  ## Tables modified
  - `seguwallet_customers`: new SELECT and INSERT policies for agent role
  - `seguwallet_customer_sicas_clients`: new SELECT and INSERT/DELETE policies for agents

  ## Security
  - Agents can only see/touch records where agent_user_id = auth.uid()
  - Agents cannot reassign customers to a different agent
*/

-- ── seguwallet_customers ─────────────────────────────────────────────

-- Allow agents to SELECT their own customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seguwallet_customers'
      AND policyname = 'Agents can view own seguwallet customers'
  ) THEN
    CREATE POLICY "Agents can view own seguwallet customers"
      ON seguwallet_customers
      FOR SELECT
      TO authenticated
      USING (agent_user_id = auth.uid());
  END IF;
END $$;

-- Allow agents to INSERT customers where they are the responsible agent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seguwallet_customers'
      AND policyname = 'Agents can create customers for themselves'
  ) THEN
    CREATE POLICY "Agents can create customers for themselves"
      ON seguwallet_customers
      FOR INSERT
      TO authenticated
      WITH CHECK (agent_user_id = auth.uid());
  END IF;
END $$;

-- Allow agents to UPDATE their own customers (status, name, phone)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seguwallet_customers'
      AND policyname = 'Agents can update own seguwallet customers'
  ) THEN
    CREATE POLICY "Agents can update own seguwallet customers"
      ON seguwallet_customers
      FOR UPDATE
      TO authenticated
      USING (agent_user_id = auth.uid())
      WITH CHECK (agent_user_id = auth.uid());
  END IF;
END $$;

-- ── seguwallet_customer_sicas_clients ────────────────────────────────

-- Allow agents to SELECT sicas assignments for their own customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seguwallet_customer_sicas_clients'
      AND policyname = 'Agents can view sicas clients for own customers'
  ) THEN
    CREATE POLICY "Agents can view sicas clients for own customers"
      ON seguwallet_customer_sicas_clients
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM seguwallet_customers sc
          WHERE sc.id = seguwallet_customer_sicas_clients.seguwallet_customer_id
            AND sc.agent_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow agents to INSERT sicas assignments for their own customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seguwallet_customer_sicas_clients'
      AND policyname = 'Agents can assign sicas clients to own customers'
  ) THEN
    CREATE POLICY "Agents can assign sicas clients to own customers"
      ON seguwallet_customer_sicas_clients
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM seguwallet_customers sc
          WHERE sc.id = seguwallet_customer_sicas_clients.seguwallet_customer_id
            AND sc.agent_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow agents to DELETE sicas assignments for their own customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seguwallet_customer_sicas_clients'
      AND policyname = 'Agents can remove sicas clients from own customers'
  ) THEN
    CREATE POLICY "Agents can remove sicas clients from own customers"
      ON seguwallet_customer_sicas_clients
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM seguwallet_customers sc
          WHERE sc.id = seguwallet_customer_sicas_clients.seguwallet_customer_id
            AND sc.agent_user_id = auth.uid()
        )
      );
  END IF;
END $$;
