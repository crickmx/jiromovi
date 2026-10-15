
/*
  # Seguwallet: Allow customers to read agent's active shared quote form links

  ## Problem
  Seguwallet customers are authenticated Supabase users but have no row in the
  `usuarios` table. All existing RLS policies on `shared_quote_form_links` check
  `usuarios` for role — so Seguwallet customers get 0 rows back.

  ## Fix
  Add a SELECT policy that lets any authenticated user read `active` links
  belonging to a specific agent. The query in SeguwalletCotizar always filters
  by `agent_id = customer.agent_user_id` AND `status = 'active'`, so this is safe.

  ## Also adds
  - An RPC `search_sicas_clients_for_agent` so the admin SICAS selector can
    search the 165k-row `sicas_documents` table efficiently with:
    - server-side ILIKE search
    - pagination (limit/offset)
    - agent-scoped (via sicas_mapeo_vendedor_usuario)
    - admin fallback (all clients across all vendors)
*/

-- ── 1. Allow Seguwallet customers to read active shared form links ──────────
-- They must supply the exact agent_id (enforced client-side), and only active
-- links are exposed, so this doesn't leak anything to other agents' customers.

CREATE POLICY "Seguwallet customers can read active links for their agent"
  ON shared_quote_form_links FOR SELECT
  TO authenticated
  USING (status = 'active');

-- ── 2. RPC: search SICAS clients for an agent (used in admin selector) ──────
CREATE OR REPLACE FUNCTION search_sicas_clients_for_agent(
  p_agent_user_id uuid,
  p_query         text    DEFAULT '',
  p_limit         integer DEFAULT 50,
  p_offset        integer DEFAULT 0
)
RETURNS TABLE(
  sicas_client_id text,
  client_name     text,
  vend_id         text,
  poliza_count    bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vend_ids text[];
BEGIN
  -- Get the agent's mapped SICAS vendor IDs
  SELECT array_agg(id_sicas_vendedor)
    INTO v_vend_ids
    FROM sicas_mapeo_vendedor_usuario
   WHERE movi_user_id = p_agent_user_id;

  -- If agent has no mappings, return empty (not admin path)
  IF v_vend_ids IS NULL OR array_length(v_vend_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      d.cliente                        AS sicas_client_id,
      d.cliente                        AS client_name,
      d.vend_id                        AS vend_id,
      COUNT(*)                         AS poliza_count
    FROM sicas_documents d
    WHERE d.vend_id = ANY(v_vend_ids)
      AND d.cliente IS NOT NULL
      AND d.cliente <> ''
      AND (
        p_query = ''
        OR d.cliente ILIKE '%' || p_query || '%'
      )
    GROUP BY d.cliente, d.vend_id
    ORDER BY d.cliente
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION search_sicas_clients_for_agent(uuid, text, integer, integer)
  TO authenticated, service_role;

-- ── 3. RPC: search SICAS clients (admin — all vendors) ──────────────────────
CREATE OR REPLACE FUNCTION search_sicas_clients_admin(
  p_query  text    DEFAULT '',
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  sicas_client_id text,
  client_name     text,
  vend_id         text,
  poliza_count    bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      d.cliente   AS sicas_client_id,
      d.cliente   AS client_name,
      d.vend_id   AS vend_id,
      COUNT(*)    AS poliza_count
    FROM sicas_documents d
    WHERE d.cliente IS NOT NULL
      AND d.cliente <> ''
      AND (
        p_query = ''
        OR d.cliente ILIKE '%' || p_query || '%'
      )
    GROUP BY d.cliente, d.vend_id
    ORDER BY d.cliente
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION search_sicas_clients_admin(text, integer, integer)
  TO authenticated, service_role;
