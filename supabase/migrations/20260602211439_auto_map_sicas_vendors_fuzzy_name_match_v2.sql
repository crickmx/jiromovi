/*
  # Auto-map SICAS vendors to MOVI users by fuzzy name matching

  ## Summary
  1,211 SICAS vendors are in 'pending_review' with no movi_user_id.
  SICAS stores names as "APELLIDO NOMBRE" while MOVI uses "NOMBRE APELLIDO".
  pg_trgm similarity finds token-set matches regardless of word order.

  ## Changes
  - Auto-activates vendors with similarity score >= 0.99 (perfect token match, just reordered)
  - Enriches match_details for score 0.75–0.99 vendors to surface the suggested user for manual review
  - Uses DISTINCT ON to pick best-scoring usuario per vendor

  ## Allowed status values: active, inactive, pending_review, rejected
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 1: Auto-confirm perfect matches → status = 'active'
WITH best_matches AS (
  SELECT DISTINCT ON (vm.id)
    vm.id AS mapping_id,
    u.id AS usuario_id,
    similarity(
      upper(vm.vend_nombre),
      upper(u.nombre || ' ' || u.apellidos)
    ) AS sim_score
  FROM sicas_vendor_user_mappings vm
  JOIN usuarios u ON similarity(
    upper(vm.vend_nombre),
    upper(u.nombre || ' ' || u.apellidos)
  ) >= 0.99
  WHERE vm.status = 'pending_review'
    AND vm.movi_user_id IS NULL
    AND vm.mapped_by IS NULL
    AND u.activo = true
    AND (u.estado IS NULL OR u.estado != 'eliminado')
  ORDER BY vm.id, sim_score DESC
)
UPDATE sicas_vendor_user_mappings vm
SET
  movi_user_id    = bm.usuario_id,
  match_type      = 'auto_name_match',
  confidence_score = bm.sim_score,
  status          = 'active',
  match_details   = jsonb_build_object(
    'method',           'fuzzy_name_similarity',
    'score',            bm.sim_score,
    'auto_confirmed',   true,
    'auto_confirmed_at', now()
  ),
  updated_at = now()
FROM best_matches bm
WHERE vm.id = bm.mapping_id;

-- Step 2: Enrich high-confidence matches (0.75–0.99) with suggested_user_id in match_details
-- Status stays pending_review — requires manual confirmation
WITH high_confidence AS (
  SELECT DISTINCT ON (vm.id)
    vm.id AS mapping_id,
    u.id AS usuario_id,
    similarity(
      upper(vm.vend_nombre),
      upper(u.nombre || ' ' || u.apellidos)
    ) AS sim_score
  FROM sicas_vendor_user_mappings vm
  JOIN usuarios u ON similarity(
    upper(vm.vend_nombre),
    upper(u.nombre || ' ' || u.apellidos)
  ) BETWEEN 0.75 AND 0.989
  WHERE vm.status = 'pending_review'
    AND vm.movi_user_id IS NULL
    AND vm.mapped_by IS NULL
    AND u.activo = true
    AND (u.estado IS NULL OR u.estado != 'eliminado')
  ORDER BY vm.id, sim_score DESC
)
UPDATE sicas_vendor_user_mappings vm
SET
  match_type       = 'suggested',
  confidence_score = hc.sim_score,
  match_details    = jsonb_build_object(
    'method',                 'fuzzy_name_similarity',
    'score',                  hc.sim_score,
    'suggested_user_id',      hc.usuario_id,
    'auto_confirmed',         false,
    'requires_manual_review', true
  ),
  updated_at = now()
FROM high_confidence hc
WHERE vm.id = hc.mapping_id
  AND vm.movi_user_id IS NULL;

-- Summary report
DO $$
DECLARE
  v_auto_mapped   integer;
  v_suggested     integer;
  v_still_pending integer;
BEGIN
  SELECT count(*) INTO v_auto_mapped   FROM sicas_vendor_user_mappings WHERE status = 'active'         AND match_type = 'auto_name_match';
  SELECT count(*) INTO v_suggested     FROM sicas_vendor_user_mappings WHERE status = 'pending_review' AND match_type = 'suggested';
  SELECT count(*) INTO v_still_pending FROM sicas_vendor_user_mappings WHERE status = 'pending_review' AND movi_user_id IS NULL AND (match_type IS NULL OR match_type NOT IN ('suggested','auto_name_match'));
  RAISE NOTICE 'Vendor mapping: % auto-mapped (active), % suggested for review, % still unmatched', v_auto_mapped, v_suggested, v_still_pending;
END $$;
