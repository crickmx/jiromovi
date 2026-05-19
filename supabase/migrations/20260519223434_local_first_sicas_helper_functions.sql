
/*
  # SICAS Local-First Helper Functions and Views

  ## Summary
  Adds database functions and views to support the local-first SICAS architecture.
  
  ## New Functions
  1. `get_sicas_coverage_stats()` — Returns mapping coverage statistics (docs, vendors, prima)
  2. `get_sicas_vendors_unmapped(limit, offset)` — Returns vendors without a MOVI user mapped
  3. `get_sicas_global_summary()` — Admin-level global production summary
  4. `run_post_sync_mapping()` — Runs after sync: assigns usuario_id to docs from vendor mappings,
     updates vendor stats, marks new vendors in mapping table

  ## New/Updated Columns
  - `sicas_sync_jobs.total_inserted` — new docs inserted (not just upserted)
  - `sicas_sync_jobs.total_updated` — existing docs updated
  - `sicas_sync_jobs.sync_type` — 'full' | 'incremental' | 'manual'
  - `sicas_sync_jobs.triggered_by_name` — name of user who triggered

  ## Security
  - All functions use SECURITY DEFINER to allow admins to call them
  - RLS on sicas_documents already filters by usuario_id for agents
*/

-- ─── Add missing columns to sicas_sync_jobs ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sicas_sync_jobs' AND column_name='total_inserted') THEN
    ALTER TABLE sicas_sync_jobs ADD COLUMN total_inserted integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sicas_sync_jobs' AND column_name='total_updated') THEN
    ALTER TABLE sicas_sync_jobs ADD COLUMN total_updated integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sicas_sync_jobs' AND column_name='sync_type') THEN
    ALTER TABLE sicas_sync_jobs ADD COLUMN sync_type text DEFAULT 'full';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sicas_sync_jobs' AND column_name='triggered_by_name') THEN
    ALTER TABLE sicas_sync_jobs ADD COLUMN triggered_by_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sicas_sync_jobs' AND column_name='post_sync_done') THEN
    ALTER TABLE sicas_sync_jobs ADD COLUMN post_sync_done boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sicas_sync_jobs' AND column_name='post_sync_at') THEN
    ALTER TABLE sicas_sync_jobs ADD COLUMN post_sync_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sicas_sync_jobs' AND column_name='docs_mapped_in_post_sync') THEN
    ALTER TABLE sicas_sync_jobs ADD COLUMN docs_mapped_in_post_sync integer DEFAULT 0;
  END IF;
END $$;

-- ─── Coverage stats function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_sicas_coverage_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_docs',           COUNT(*),
    'docs_with_user',       COUNT(usuario_id),
    'docs_without_user',    COUNT(*) - COUNT(usuario_id),
    'coverage_pct',         CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(usuario_id)::numeric / COUNT(*)) * 100, 1) ELSE 0 END,
    'total_vigentes',       COUNT(*) FILTER (WHERE is_vigente = true),
    'vigentes_with_user',   COUNT(*) FILTER (WHERE is_vigente = true AND usuario_id IS NOT NULL),
    'vigentes_without_user', COUNT(*) FILTER (WHERE is_vigente = true AND usuario_id IS NULL),
    'prima_total',          COALESCE(SUM(prima_neta), 0),
    'prima_asignada',       COALESCE(SUM(prima_neta) FILTER (WHERE usuario_id IS NOT NULL), 0),
    'prima_sin_asignar',    COALESCE(SUM(prima_neta) FILTER (WHERE usuario_id IS NULL), 0),
    'prima_coverage_pct',   CASE WHEN SUM(prima_neta) > 0 
                              THEN ROUND((SUM(prima_neta) FILTER (WHERE usuario_id IS NOT NULL) / SUM(prima_neta)) * 100, 1) 
                              ELSE 0 END,
    'unique_vendors',       COUNT(DISTINCT vend_id),
    'last_sync',            MAX(synced_at)
  ) INTO result
  FROM sicas_documents;

  -- Add vendor mapping stats
  SELECT result || jsonb_build_object(
    'total_vendor_mappings',   COUNT(*),
    'active_vendor_mappings',  COUNT(*) FILTER (WHERE status = 'active' AND movi_user_id IS NOT NULL),
    'pending_vendor_mappings', COUNT(*) FILTER (WHERE status = 'pending_review' OR movi_user_id IS NULL)
  ) INTO result
  FROM sicas_vendor_user_mappings;

  RETURN result;
END;
$$;

-- ─── Unmapped vendors function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_sicas_vendors_unmapped(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  vend_id text,
  vend_nombre text,
  desp_nombre text,
  total_docs bigint,
  vigentes bigint,
  prima_neta numeric,
  prima_vigente numeric,
  ultimo_documento timestamptz,
  suggested_user_id uuid,
  suggested_user_name text,
  mapping_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH vendor_stats AS (
    SELECT
      d.vend_id,
      MAX(d.vend_nombre) AS vend_nombre,
      MAX(d.desp_nombre) AS desp_nombre,
      COUNT(*) AS total_docs,
      COUNT(*) FILTER (WHERE d.is_vigente) AS vigentes,
      COALESCE(SUM(d.prima_neta), 0) AS prima_neta,
      COALESCE(SUM(d.prima_neta) FILTER (WHERE d.is_vigente), 0) AS prima_vigente,
      MAX(d.synced_at) AS ultimo_documento
    FROM sicas_documents d
    WHERE d.usuario_id IS NULL
      AND d.vend_id IS NOT NULL
      AND (p_search IS NULL OR d.vend_id ILIKE '%' || p_search || '%' OR d.vend_nombre ILIKE '%' || p_search || '%')
    GROUP BY d.vend_id
  )
  SELECT
    vs.vend_id,
    vs.vend_nombre,
    vs.desp_nombre,
    vs.total_docs,
    vs.vigentes,
    vs.prima_neta,
    vs.prima_vigente,
    vs.ultimo_documento,
    m.movi_user_id AS suggested_user_id,
    NULL::text AS suggested_user_name,
    COALESCE(m.status, 'pending_review') AS mapping_status
  FROM vendor_stats vs
  LEFT JOIN sicas_vendor_user_mappings m ON m.vend_id = vs.vend_id
  ORDER BY vs.prima_neta DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ─── Global summary function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_sicas_global_summary(
  p_oficina_id uuid DEFAULT NULL,
  p_ramo text DEFAULT NULL,
  p_compania text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_docs',         COUNT(*),
    'total_vigentes',     COUNT(*) FILTER (WHERE is_vigente),
    'total_canceladas',   COUNT(*) FILTER (WHERE is_cancelada),
    'total_vencidas',     COUNT(*) FILTER (WHERE NOT is_vigente AND NOT is_cancelada AND vigencia_hasta < now()),
    'prima_total',        COALESCE(SUM(prima_neta), 0),
    'prima_vigente',      COALESCE(SUM(prima_neta) FILTER (WHERE is_vigente), 0),
    'renovaciones_60d',   COUNT(*) FILTER (WHERE is_vigente AND renewal_days_remaining BETWEEN 0 AND 60),
    'renovaciones_30d',   COUNT(*) FILTER (WHERE is_vigente AND renewal_days_remaining BETWEEN 0 AND 30),
    'unique_vendors',     COUNT(DISTINCT vend_id),
    'unique_aseguradoras',COUNT(DISTINCT compania),
    'unique_ramos',       COUNT(DISTINCT ramo),
    'unique_clientes',    COUNT(DISTINCT cliente),
    'docs_with_user',     COUNT(usuario_id),
    'docs_without_user',  COUNT(*) - COUNT(usuario_id)
  ) INTO result
  FROM sicas_documents
  WHERE (p_oficina_id IS NULL OR oficina_id = p_oficina_id)
    AND (p_ramo IS NULL OR ramo = p_ramo)
    AND (p_compania IS NULL OR compania = p_compania);

  RETURN result;
END;
$$;

-- ─── Post-sync mapping function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION run_post_sync_mapping(p_job_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mapped integer := 0;
  v_new_vendors integer := 0;
BEGIN
  -- Step 1: Apply active vendor mappings to unmapped documents
  WITH mapping_update AS (
    UPDATE sicas_documents d
    SET 
      usuario_id = m.movi_user_id,
      updated_at = now()
    FROM sicas_vendor_user_mappings m
    WHERE m.vend_id = d.vend_id
      AND m.status = 'active'
      AND m.movi_user_id IS NOT NULL
      AND d.usuario_id IS NULL
    RETURNING d.id
  )
  SELECT COUNT(*) INTO v_mapped FROM mapping_update;

  -- Step 2: Upsert new vendors discovered from documents into mapping table
  WITH new_vendors AS (
    INSERT INTO sicas_vendor_user_mappings (vend_id, vend_nombre, desp_nombre, total_docs, total_prima_neta, last_doc_date, status, match_type)
    SELECT 
      d.vend_id,
      MAX(d.vend_nombre),
      MAX(d.desp_nombre),
      COUNT(*),
      COALESCE(SUM(d.prima_neta), 0),
      MAX(d.synced_at),
      'pending_review',
      'no_match'
    FROM sicas_documents d
    WHERE d.vend_id IS NOT NULL
    GROUP BY d.vend_id
    ON CONFLICT (vend_id) DO UPDATE SET
      total_docs = EXCLUDED.total_docs,
      total_prima_neta = EXCLUDED.total_prima_neta,
      last_doc_date = EXCLUDED.last_doc_date,
      vend_nombre = COALESCE(sicas_vendor_user_mappings.vend_nombre, EXCLUDED.vend_nombre),
      updated_at = now()
    RETURNING vend_id
  )
  SELECT COUNT(*) INTO v_new_vendors FROM new_vendors;

  -- Step 3: Update job record if provided
  IF p_job_id IS NOT NULL THEN
    UPDATE sicas_sync_jobs
    SET 
      post_sync_done = true,
      post_sync_at = now(),
      docs_mapped_in_post_sync = v_mapped,
      updated_at = now()
    WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object(
    'docs_mapped', v_mapped,
    'vendors_updated', v_new_vendors,
    'ran_at', now()
  );
END;
$$;

-- ─── Grant execute to authenticated users (coverage stats is public to admins) ─
GRANT EXECUTE ON FUNCTION get_sicas_coverage_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_sicas_vendors_unmapped(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sicas_global_summary(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION run_post_sync_mapping(uuid) TO service_role;
