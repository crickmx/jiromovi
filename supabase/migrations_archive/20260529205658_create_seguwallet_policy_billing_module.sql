/*
  # Seguwallet Policy Billing Module

  ## Summary
  Adds a secure billing consultation function for Seguwallet customers to view
  cobranza (payment/collection) information per policy from SICAS data.

  ## New Tables
  - `seguwallet_billing_logs` - Audit log of billing queries by customer

  ## New Functions
  - `get_seguwallet_policy_billing(p_auth_id, p_poliza, p_id_docto)` - Returns
    billing records for a specific policy, validating that the policy belongs
    to the authenticated Seguwallet customer's linked SICAS clients.

  ## Security
  - SECURITY DEFINER function validates customer ownership before returning data
  - RLS on billing_logs allows customers to see only their own records
  - No data modification — read-only access to sicas_cobranza_pendiente
*/

-- ─── Audit log for billing queries ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seguwallet_billing_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid REFERENCES seguwallet_customers(id) ON DELETE CASCADE,
  poliza           text,
  id_docto         text,
  result           text DEFAULT 'success',
  records_returned integer DEFAULT 0,
  error_message    text,
  queried_at       timestamptz DEFAULT now()
);

ALTER TABLE seguwallet_billing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers see own billing logs"
  ON seguwallet_billing_logs FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM seguwallet_customers
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access billing logs"
  ON seguwallet_billing_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_billing_logs_customer_id ON seguwallet_billing_logs(customer_id);

-- ─── RPC: get billing for a specific policy ───────────────────────────────────

CREATE OR REPLACE FUNCTION get_seguwallet_policy_billing(
  p_auth_id  uuid,
  p_poliza   text,
  p_id_docto text DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  cliente          text,
  no_poliza        text,
  id_documento     text,
  importe_pendiente numeric,
  fecha_limite     timestamptz,
  dias_vencidos    integer,
  status           text,
  vend_id          text,
  vend_nombre      text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- 1. Resolve customer
  SELECT sc.id INTO v_customer_id
  FROM seguwallet_customers sc
  WHERE sc.auth_user_id = p_auth_id
    AND sc.status = 'active'
    AND sc.deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO seguwallet_billing_logs(customer_id, poliza, id_docto, result, error_message)
    VALUES (NULL, p_poliza, p_id_docto, 'denied', 'customer_not_found');
    RETURN;
  END IF;

  -- 2. Validate policy belongs to one of this customer's SICAS clients
  IF NOT EXISTS (
    SELECT 1 FROM sicas_documents d
    JOIN seguwallet_customer_sicas_clients sc_link
      ON sc_link.sicas_client_id = d.cliente
      AND sc_link.seguwallet_customer_id = v_customer_id
    WHERE d.poliza = p_poliza
      AND d.is_poliza = true
  ) THEN
    INSERT INTO seguwallet_billing_logs(customer_id, poliza, id_docto, result, error_message)
    VALUES (v_customer_id, p_poliza, p_id_docto, 'denied', 'policy_not_owned');
    RETURN;
  END IF;

  -- 3. Log successful query
  INSERT INTO seguwallet_billing_logs(customer_id, poliza, id_docto, result, records_returned)
  SELECT
    v_customer_id, p_poliza, p_id_docto, 'success',
    COUNT(*)::integer
  FROM sicas_cobranza_pendiente c
  WHERE c.no_poliza = p_poliza;

  -- 4. Return billing records
  RETURN QUERY
  SELECT
    c.id,
    c.cliente,
    c.no_poliza,
    c.id_documento,
    c.importe_pendiente,
    c.fecha_limite,
    c.dias_vencidos,
    c.status,
    c.vend_id,
    c.vend_nombre
  FROM sicas_cobranza_pendiente c
  WHERE c.no_poliza = p_poliza
  ORDER BY c.fecha_limite ASC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION get_seguwallet_policy_billing(uuid, text, text) TO authenticated;
