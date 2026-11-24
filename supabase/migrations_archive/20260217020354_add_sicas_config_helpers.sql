/*
  # SICAS Config Helpers

  1. Functions
    - `get_sicas_sync_stats` - Returns sync statistics
    
  2. Security
    - Functions are accessible to authenticated users
*/

-- Function to get SICAS sync stats
CREATE OR REPLACE FUNCTION get_sicas_sync_stats()
RETURNS TABLE (
  despachos_count bigint,
  vendedores_count bigint,
  documents_count bigint,
  polizas_vigentes_count bigint,
  last_sync_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM sicas_despachos)::bigint,
    (SELECT COUNT(*) FROM sicas_vendedores)::bigint,
    (SELECT COUNT(*) FROM sicas_documents)::bigint,
    (SELECT COUNT(*) FROM sicas_polizas_vigentes)::bigint,
    (SELECT MAX(synced_at) FROM sicas_documents);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_sicas_sync_stats() TO authenticated;
