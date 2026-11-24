/*
  # Create SICAS sync diagnostics function

  1. New Functions
    - `get_sicas_sync_diagnostics()` - Returns comprehensive diagnostic data about the SICAS sync system
      - Total documents, polizas, fianzas, vigentes, canceladas, renewables
      - Distinct vendors and aseguradoras
      - Documents with usuario_id and oficina_id
      - Last sync timestamp, status, and record count

  2. Security
    - SECURITY DEFINER with search_path set to public
    - Accessible by authenticated users (admin use)
*/

CREATE OR REPLACE FUNCTION get_sicas_sync_diagnostics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'lastSyncRecords', COALESCE(v_last_sync_records, 0)
  );

  RETURN v_result;
END;
$function$;
