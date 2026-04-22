/*
  # Fix SICAS diagnostics vendor column name

  1. Changes
    - Fix column reference from `id_vendedor` to `id_sicas_vendedor` in sicas_mapeo_vendedor_usuario
*/

CREATE OR REPLACE FUNCTION get_sicas_sync_diagnostics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_total integer;
  v_polizas integer;
  v_fianzas integer;
  v_vigentes integer;
  v_canceladas integer;
  v_renewables integer;
  v_distinct_vendors integer;
  v_distinct_aseguradoras integer;
  v_with_user_id integer;
  v_with_oficina_id integer;
  v_last_sync_at timestamptz;
  v_last_sync_status text;
  v_last_sync_records integer;
  v_stuck_runs integer;
  v_mapped_vendor_ids integer;
  v_unmapped_vendor_ids integer;
  v_unmapped_vendor_list jsonb;
  v_user_map_entries integer;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_poliza = true),
    COUNT(*) FILTER (WHERE is_fianza = true),
    COUNT(*) FILTER (WHERE is_vigente = true),
    COUNT(*) FILTER (WHERE is_cancelada = true),
    COUNT(*) FILTER (WHERE is_renewable = true),
    COUNT(DISTINCT vend_id) FILTER (WHERE vend_id IS NOT NULL AND vend_id != ''),
    COUNT(DISTINCT aseguradora_nombre) FILTER (WHERE aseguradora_nombre IS NOT NULL AND aseguradora_nombre != ''),
    COUNT(*) FILTER (WHERE usuario_id IS NOT NULL),
    COUNT(*) FILTER (WHERE oficina_id IS NOT NULL)
  INTO
    v_total, v_polizas, v_fianzas, v_vigentes, v_canceladas, v_renewables,
    v_distinct_vendors, v_distinct_aseguradoras, v_with_user_id, v_with_oficina_id
  FROM sicas_documents;

  SELECT finished_at, status, records_upserted
  INTO v_last_sync_at, v_last_sync_status, v_last_sync_records
  FROM sicas_sync_runs
  WHERE status IN ('completed', 'success')
  ORDER BY finished_at DESC NULLS LAST
  LIMIT 1;

  SELECT COUNT(*)
  INTO v_stuck_runs
  FROM sicas_sync_runs
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '30 minutes';

  SELECT COUNT(DISTINCT sd.vend_id)
  INTO v_mapped_vendor_ids
  FROM sicas_documents sd
  WHERE sd.vend_id IS NOT NULL AND sd.vend_id != ''
    AND (
      EXISTS (SELECT 1 FROM sicas_mapeo_vendedor_usuario m WHERE m.id_sicas_vendedor::text = sd.vend_id)
      OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id_sicas = sd.vend_id AND u.activo = true)
    );

  SELECT COUNT(DISTINCT sd.vend_id)
  INTO v_unmapped_vendor_ids
  FROM sicas_documents sd
  WHERE sd.vend_id IS NOT NULL AND sd.vend_id != ''
    AND NOT EXISTS (SELECT 1 FROM sicas_mapeo_vendedor_usuario m WHERE m.id_sicas_vendedor::text = sd.vend_id)
    AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id_sicas = sd.vend_id AND u.activo = true);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vendId', sub.vend_id,
    'vendName', sub.vend_name,
    'docCount', sub.cnt
  ) ORDER BY sub.cnt DESC), '[]'::jsonb)
  INTO v_unmapped_vendor_list
  FROM (
    SELECT sd.vend_id, MAX(sd.vend_nombre) as vend_name, COUNT(*) as cnt
    FROM sicas_documents sd
    WHERE sd.vend_id IS NOT NULL AND sd.vend_id != ''
      AND NOT EXISTS (SELECT 1 FROM sicas_mapeo_vendedor_usuario m WHERE m.id_sicas_vendedor::text = sd.vend_id)
      AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id_sicas = sd.vend_id AND u.activo = true)
    GROUP BY sd.vend_id
  ) sub;

  SELECT COUNT(*)
  INTO v_user_map_entries
  FROM sicas_document_user_map;

  v_result := jsonb_build_object(
    'totalDocs', v_total,
    'polizas', v_polizas,
    'fianzas', v_fianzas,
    'vigentes', v_vigentes,
    'canceladas', v_canceladas,
    'renewables', v_renewables,
    'distinctVendors', v_distinct_vendors,
    'distinctAseguradoras', v_distinct_aseguradoras,
    'withUserId', v_with_user_id,
    'withOficinaId', v_with_oficina_id,
    'lastSyncAt', v_last_sync_at,
    'lastSyncStatus', v_last_sync_status,
    'lastSyncRecords', COALESCE(v_last_sync_records, 0),
    'stuckRuns', v_stuck_runs,
    'mappedVendorIds', v_mapped_vendor_ids,
    'unmappedVendorIds', v_unmapped_vendor_ids,
    'unmappedVendors', v_unmapped_vendor_list,
    'userMapEntries', v_user_map_entries
  );

  RETURN v_result;
END;
$$;
