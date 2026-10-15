/*
  # Fix Seguwallet Polizas - SECURITY DEFINER RPC functions

  ## Problem
  The `seguwallet_customer_sicas_docs_select` policy on `sicas_documents` contains a
  subquery reading from `seguwallet_customer_sicas_clients`, which itself is RLS-protected.
  This nested RLS evaluation fails silently for Seguwallet customers who are not
  MOVI platform users, causing the Polizas page to return empty results.

  ## Solution
  Create SECURITY DEFINER functions that bypass nested RLS by running as the
  function owner (postgres), while still scoping results to the calling user's
  linked SICAS clients.

  ## New Functions
  1. `get_seguwallet_customer_sicas_clients(uuid)` — returns linked SICAS client IDs
  2. `get_seguwallet_polizas(uuid)` — returns policy records for the customer
  3. `get_seguwallet_poliza_counts(uuid)` — returns vigentes + proximas_vencer counts
*/

-- Function to get SICAS client IDs for a seguwallet customer
CREATE OR REPLACE FUNCTION get_seguwallet_customer_sicas_clients(p_auth_id uuid)
RETURNS TABLE (
  seguwallet_customer_id uuid,
  sicas_client_id text,
  sicas_client_name text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    sc_link.seguwallet_customer_id,
    sc_link.sicas_client_id,
    sc_link.sicas_client_name
  FROM seguwallet_customer_sicas_clients sc_link
  JOIN seguwallet_customers sc ON sc.id = sc_link.seguwallet_customer_id
  WHERE sc.auth_user_id = p_auth_id
    AND sc.status = 'active';
$$;

GRANT EXECUTE ON FUNCTION get_seguwallet_customer_sicas_clients(uuid) TO authenticated;

-- Function to get policies for a seguwallet customer
-- Uses correct sicas_documents columns (no contratante, uses cliente)
CREATE OR REPLACE FUNCTION get_seguwallet_polizas(p_auth_id uuid)
RETURNS TABLE (
  id uuid,
  poliza text,
  aseguradora_nombre text,
  ramo text,
  cliente text,
  vigencia_desde date,
  vigencia_hasta date,
  is_vigente boolean,
  is_cancelada boolean,
  prima_total numeric,
  moneda text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    d.id,
    d.poliza,
    d.aseguradora_nombre,
    d.ramo,
    d.cliente,
    d.vigencia_desde,
    d.vigencia_hasta,
    d.is_vigente,
    d.is_cancelada,
    d.prima_total,
    d.moneda
  FROM sicas_documents d
  WHERE d.is_poliza = true
    AND d.cliente IN (
      SELECT sc_link.sicas_client_id
      FROM seguwallet_customer_sicas_clients sc_link
      JOIN seguwallet_customers sc ON sc.id = sc_link.seguwallet_customer_id
      WHERE sc.auth_user_id = p_auth_id
        AND sc.status = 'active'
    )
  ORDER BY d.vigencia_hasta DESC
  LIMIT 300;
$$;

GRANT EXECUTE ON FUNCTION get_seguwallet_polizas(uuid) TO authenticated;

-- Counts function for dashboard
CREATE OR REPLACE FUNCTION get_seguwallet_poliza_counts(p_auth_id uuid)
RETURNS TABLE (
  total_vigentes bigint,
  proximas_vencer bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE d.is_vigente = true) AS total_vigentes,
    COUNT(*) FILTER (
      WHERE d.is_vigente = true
        AND d.vigencia_hasta <= (CURRENT_DATE + INTERVAL '30 days')
    ) AS proximas_vencer
  FROM sicas_documents d
  WHERE d.is_poliza = true
    AND d.cliente IN (
      SELECT sc_link.sicas_client_id
      FROM seguwallet_customer_sicas_clients sc_link
      JOIN seguwallet_customers sc ON sc.id = sc_link.seguwallet_customer_id
      WHERE sc.auth_user_id = p_auth_id
        AND sc.status = 'active'
    );
$$;

GRANT EXECUTE ON FUNCTION get_seguwallet_poliza_counts(uuid) TO authenticated;
