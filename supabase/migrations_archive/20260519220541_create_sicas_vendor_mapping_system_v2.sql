
/*
  # Sistema Completo de Mapeo Vendedores SICAS v2

  ## Correcciones respecto a v1
  - Constraint de unicidad no deferrable para soportar ON CONFLICT
  - Lógica de inserción simplificada sin conflicto deferrable
  
  ## Tablas nuevas
  - `sicas_vendor_user_mappings`: mapeos vendedor SICAS -> usuario MOVI con confidence_score
  - `sicas_data_quality_log`: log de correcciones de calidad
  - `sicas_derived_aseguradoras`: catálogo de aseguradoras derivado de documentos

  ## Funciones
  - `normalize_name_for_sicas(text)`: normaliza nombres para comparación
  - `sicas_auto_map_vendors(boolean)`: automapeo por id_sicas, nombre_sicas, nombre norm
  - `sicas_fix_expired_vigentes(boolean)`: corrige vigentes con fecha vencida
  - `sicas_build_derived_aseguradoras()`: construye catálogo desde documentos
  - `sicas_get_health_report()`: reporte JSON de salud completo
  - `sicas_sync_mapping_stats()`: actualiza estadísticas de mapeos
*/

-- =============================================
-- 1. TABLA: sicas_vendor_user_mappings
-- =============================================
CREATE TABLE IF NOT EXISTS sicas_vendor_user_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vend_id text NOT NULL,
  vend_nombre text NOT NULL,
  desp_nombre text,
  desp_id text,
  movi_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  match_type text NOT NULL DEFAULT 'manual',
  confidence_score numeric(5,2) DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  match_details jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_review', 'rejected')),
  total_docs integer DEFAULT 0,
  total_prima_neta numeric DEFAULT 0,
  last_doc_date timestamptz,
  mapped_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  mapped_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (vend_id)
);

CREATE INDEX IF NOT EXISTS idx_sicas_vum_vend_id ON sicas_vendor_user_mappings(vend_id);
CREATE INDEX IF NOT EXISTS idx_sicas_vum_movi_user_id ON sicas_vendor_user_mappings(movi_user_id);
CREATE INDEX IF NOT EXISTS idx_sicas_vum_status ON sicas_vendor_user_mappings(status);

ALTER TABLE sicas_vendor_user_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sicas vendor mappings"
  ON sicas_vendor_user_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and gerente can insert sicas vendor mappings"
  ON sicas_vendor_user_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador','Gerente') AND activo = true AND is_deleted = false)
  );

CREATE POLICY "Admin and gerente can update sicas vendor mappings"
  ON sicas_vendor_user_mappings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador','Gerente') AND activo = true AND is_deleted = false))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('Administrador','Gerente') AND activo = true AND is_deleted = false));

CREATE POLICY "Admin can delete sicas vendor mappings"
  ON sicas_vendor_user_mappings FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true AND is_deleted = false));

-- =============================================
-- 2. TABLA: sicas_data_quality_log
-- =============================================
CREATE TABLE IF NOT EXISTS sicas_data_quality_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL,
  run_at timestamptz DEFAULT now(),
  records_checked integer DEFAULT 0,
  records_affected integer DEFAULT 0,
  records_fixed integer DEFAULT 0,
  details jsonb DEFAULT '{}',
  fix_applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sicas_dql_check_type ON sicas_data_quality_log(check_type);
CREATE INDEX IF NOT EXISTS idx_sicas_dql_run_at ON sicas_data_quality_log(run_at DESC);

ALTER TABLE sicas_data_quality_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read data quality log"
  ON sicas_data_quality_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin can insert data quality log"
  ON sicas_data_quality_log FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador' AND activo = true AND is_deleted = false));

-- =============================================
-- 3. TABLA: sicas_derived_aseguradoras
-- =============================================
CREATE TABLE IF NOT EXISTS sicas_derived_aseguradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  nombre_normalizado text,
  total_docs integer DEFAULT 0,
  total_vigentes integer DEFAULT 0,
  total_prima_neta numeric DEFAULT 0,
  source_type text DEFAULT 'derived' CHECK (source_type IN ('official', 'derived', 'manual')),
  last_seen_in_docs timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sicas_derived_aseguradoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read derived aseguradoras"
  ON sicas_derived_aseguradoras FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin can manage derived aseguradoras"
  ON sicas_derived_aseguradoras FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can update derived aseguradoras"
  ON sicas_derived_aseguradoras FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- 4. FUNCIÓN: Normalizar nombre
-- =============================================
CREATE OR REPLACE FUNCTION normalize_name_for_sicas(input_name text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE result text;
BEGIN
  IF input_name IS NULL THEN RETURN NULL; END IF;
  result := upper(trim(input_name));
  result := translate(result, 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑáéíóúàèìòùäëïöüñ', 'AEIOUAEIOUAEIOUNaeiouaeiouaeioun');
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := regexp_replace(result, '-\s*\d+\s*$', '', 'g');
  result := regexp_replace(result, '-\s*(QRO|QUERETARO|TOLUCA|CDMX|MTY|GDL)\s*$', '', 'gi');
  result := trim(result);
  RETURN result;
END;
$$;

-- =============================================
-- 5. FUNCIÓN: Auto-mapeo vendedores
-- =============================================
CREATE OR REPLACE FUNCTION sicas_auto_map_vendors(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mapped_count integer := 0;
  v_id_exact_count integer := 0;
  v_nombre_sicas_count integer := 0;
  v_nombre_norm_count integer := 0;
  v_nombre_inv_count integer := 0;
  v_total_vendors integer := 0;
  v_already_mapped integer := 0;
  v_rec record;
  v_user_id uuid;
  v_confidence numeric;
  v_match_type text;
  v_match_details jsonb;
  v_words text[];
  v_inverted text;
BEGIN
  SELECT COUNT(DISTINCT vend_id) INTO v_total_vendors FROM sicas_documents;
  SELECT COUNT(*) INTO v_already_mapped FROM sicas_vendor_user_mappings WHERE status IN ('active', 'pending_review');

  FOR v_rec IN
    SELECT DISTINCT ON (d.vend_id)
      d.vend_id,
      d.vend_nombre,
      d.desp_nombre,
      COUNT(*) OVER (PARTITION BY d.vend_id) as total_docs,
      SUM(d.prima_neta) OVER (PARTITION BY d.vend_id) as total_prima,
      MAX(d.fecha_captura) OVER (PARTITION BY d.vend_id) as last_doc
    FROM sicas_documents d
    WHERE d.vend_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM sicas_vendor_user_mappings m
        WHERE m.vend_id = d.vend_id
      )
    ORDER BY d.vend_id, d.fecha_captura DESC
  LOOP
    v_user_id := NULL; v_confidence := 0; v_match_type := NULL; v_match_details := '{}';

    -- Método 1: id_sicas exacto
    SELECT u.id INTO v_user_id FROM usuarios u
    WHERE u.id_sicas = v_rec.vend_id AND u.activo = true AND u.is_deleted = false LIMIT 1;
    IF v_user_id IS NOT NULL THEN
      v_confidence := 99; v_match_type := 'id_sicas_exact';
      v_match_details := jsonb_build_object('method','id_sicas','vend_id',v_rec.vend_id);
      v_id_exact_count := v_id_exact_count + 1;
    END IF;

    -- Método 2: nombre_sicas exacto
    IF v_user_id IS NULL THEN
      SELECT u.id INTO v_user_id FROM usuarios u
      WHERE upper(trim(COALESCE(u.nombre_sicas,''))) = upper(trim(v_rec.vend_nombre))
        AND u.activo = true AND u.is_deleted = false LIMIT 1;
      IF v_user_id IS NOT NULL THEN
        v_confidence := 95; v_match_type := 'nombre_sicas_exact';
        v_match_details := jsonb_build_object('method','nombre_sicas','vend_nombre',v_rec.vend_nombre);
        v_nombre_sicas_count := v_nombre_sicas_count + 1;
      END IF;
    END IF;

    -- Método 3: nombre normalizado directo
    IF v_user_id IS NULL THEN
      SELECT u.id INTO v_user_id FROM usuarios u
      WHERE normalize_name_for_sicas(u.nombre_completo) = normalize_name_for_sicas(v_rec.vend_nombre)
        AND u.activo = true AND u.is_deleted = false
        AND u.rol IN ('Agente','Gerente','Ejecutivo') LIMIT 1;
      IF v_user_id IS NOT NULL THEN
        v_confidence := 82; v_match_type := 'nombre_normalizado';
        v_match_details := jsonb_build_object('method','nombre_norm','norm',normalize_name_for_sicas(v_rec.vend_nombre));
        v_nombre_norm_count := v_nombre_norm_count + 1;
      END IF;
    END IF;

    -- Método 4: nombre invertido (APELLIDO NOMBRE -> NOMBRE APELLIDO)
    IF v_user_id IS NULL AND length(v_rec.vend_nombre) > 5 THEN
      v_words := string_to_array(normalize_name_for_sicas(v_rec.vend_nombre), ' ');
      IF array_length(v_words, 1) >= 2 THEN
        v_inverted := array_to_string(v_words[2:array_length(v_words,1)], ' ') || ' ' || v_words[1];
        SELECT u.id INTO v_user_id FROM usuarios u
        WHERE normalize_name_for_sicas(u.nombre_completo) = v_inverted
          AND u.activo = true AND u.is_deleted = false
          AND u.rol IN ('Agente','Gerente','Ejecutivo') LIMIT 1;
        IF v_user_id IS NOT NULL THEN
          v_confidence := 72; v_match_type := 'nombre_invertido';
          v_match_details := jsonb_build_object('method','nombre_inv','original',v_rec.vend_nombre,'inverted',v_inverted);
          v_nombre_inv_count := v_nombre_inv_count + 1;
        END IF;
      END IF;
    END IF;

    -- Insertar si hay match
    IF v_user_id IS NOT NULL THEN
      v_mapped_count := v_mapped_count + 1;
      IF NOT p_dry_run THEN
        INSERT INTO sicas_vendor_user_mappings (
          vend_id, vend_nombre, desp_nombre,
          movi_user_id, match_type, confidence_score, match_details,
          status, total_docs, total_prima_neta, last_doc_date, mapped_at
        ) VALUES (
          v_rec.vend_id, v_rec.vend_nombre, v_rec.desp_nombre,
          v_user_id, v_match_type, v_confidence, v_match_details,
          CASE WHEN v_confidence >= 80 THEN 'active' ELSE 'pending_review' END,
          COALESCE(v_rec.total_docs,0), COALESCE(v_rec.total_prima,0), v_rec.last_doc, now()
        ) ON CONFLICT (vend_id) DO UPDATE SET
          movi_user_id = EXCLUDED.movi_user_id,
          match_type = EXCLUDED.match_type,
          confidence_score = EXCLUDED.confidence_score,
          status = EXCLUDED.status,
          updated_at = now();

        -- Actualizar usuario_id en documentos si confianza alta
        IF v_confidence >= 80 THEN
          UPDATE sicas_documents SET usuario_id = v_user_id
          WHERE vend_id = v_rec.vend_id AND usuario_id IS NULL;
        END IF;
      END IF;
    ELSE
      -- Crear registro de pending sin usuario para revisión manual
      IF NOT p_dry_run THEN
        INSERT INTO sicas_vendor_user_mappings (
          vend_id, vend_nombre, desp_nombre,
          movi_user_id, match_type, confidence_score,
          status, total_docs, total_prima_neta, last_doc_date, mapped_at
        ) VALUES (
          v_rec.vend_id, v_rec.vend_nombre, v_rec.desp_nombre,
          NULL, 'no_match', 0,
          'pending_review', COALESCE(v_rec.total_docs,0), COALESCE(v_rec.total_prima,0), v_rec.last_doc, now()
        ) ON CONFLICT (vend_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- Actualizar ya_mapeados
  SELECT COUNT(*) INTO v_already_mapped FROM sicas_vendor_user_mappings WHERE status = 'active';

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'total_vendors_in_docs', v_total_vendors,
    'newly_mapped', v_mapped_count,
    'active_mappings_after', v_already_mapped,
    'by_method', jsonb_build_object(
      'id_sicas_exact', v_id_exact_count,
      'nombre_sicas', v_nombre_sicas_count,
      'nombre_normalizado', v_nombre_norm_count,
      'nombre_invertido', v_nombre_inv_count
    ),
    'run_at', now()
  );
END;
$$;

-- =============================================
-- 6. FUNCIÓN: Corregir pólizas vencidas
-- =============================================
CREATE OR REPLACE FUNCTION sicas_fix_expired_vigentes(p_apply boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer; v_anomalous integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM sicas_documents
  WHERE is_vigente = true AND vigencia_hasta < NOW()
    AND vigencia_hasta > '1950-01-01' AND vigencia_hasta < '2100-01-01';

  SELECT COUNT(*) INTO v_anomalous FROM sicas_documents
  WHERE vigencia_hasta < '1950-01-01' OR vigencia_hasta > '2100-01-01'
     OR vigencia_desde < '1950-01-01';

  IF p_apply THEN
    UPDATE sicas_documents SET is_vigente = false, updated_at = now()
    WHERE is_vigente = true AND vigencia_hasta < NOW()
      AND vigencia_hasta > '1950-01-01' AND vigencia_hasta < '2100-01-01';

    INSERT INTO sicas_data_quality_log (check_type, records_checked, records_affected, records_fixed, fix_applied, details)
    SELECT 'expired_vigentes', COUNT(*), v_count, v_count, true,
      jsonb_build_object('fixed', v_count, 'anomalous', v_anomalous, 'ts', now())
    FROM sicas_documents;
  END IF;

  RETURN jsonb_build_object(
    'expired_vigentes_found', v_count, 'anomalous_dates', v_anomalous,
    'fix_applied', p_apply, 'run_at', now()
  );
END;
$$;

-- =============================================
-- 7. FUNCIÓN: Construir catálogo derivado aseguradoras
-- =============================================
CREATE OR REPLACE FUNCTION sicas_build_derived_aseguradoras()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cnt integer;
BEGIN
  INSERT INTO sicas_derived_aseguradoras (
    nombre, nombre_normalizado, total_docs, total_vigentes, total_prima_neta, source_type, last_seen_in_docs
  )
  SELECT compania,
    normalize_name_for_sicas(compania),
    COUNT(*), COUNT(*) FILTER (WHERE is_vigente), COALESCE(SUM(prima_neta),0),
    'derived', MAX(fecha_captura)
  FROM sicas_documents
  WHERE compania IS NOT NULL AND compania != ''
  GROUP BY compania
  ON CONFLICT (nombre) DO UPDATE SET
    nombre_normalizado = EXCLUDED.nombre_normalizado,
    total_docs = EXCLUDED.total_docs,
    total_vigentes = EXCLUDED.total_vigentes,
    total_prima_neta = EXCLUDED.total_prima_neta,
    last_seen_in_docs = EXCLUDED.last_seen_in_docs,
    updated_at = now();
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN jsonb_build_object('upserted', v_cnt, 'run_at', now());
END;
$$;

-- =============================================
-- 8. FUNCIÓN: Reporte de salud SICAS
-- =============================================
CREATE OR REPLACE FUNCTION sicas_get_health_report()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg record; v_docs record; v_map record;
  v_sync record; v_qual record; v_ren record;
BEGIN
  SELECT * INTO v_cfg FROM sicas_config LIMIT 1;

  SELECT COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_vigente) as vigentes,
    COUNT(*) FILTER (WHERE is_renewable) as renovables,
    COUNT(*) FILTER (WHERE usuario_id IS NOT NULL) as con_usuario,
    COUNT(DISTINCT vend_id) as total_vendors,
    MAX(synced_at) as last_sync
  INTO v_docs FROM sicas_documents;

  SELECT COUNT(*) as total,
    COUNT(*) FILTER (WHERE status='active') as active_m,
    COUNT(*) FILTER (WHERE status='pending_review') as pending_m,
    COUNT(*) FILTER (WHERE movi_user_id IS NOT NULL) as with_user
  INTO v_map FROM sicas_vendor_user_mappings;

  SELECT
    COUNT(*) FILTER (WHERE status='completed') as completed,
    COUNT(*) FILTER (WHERE status='failed') as failed,
    COUNT(*) FILTER (WHERE status='running' AND started_at < NOW()-INTERVAL'2h') as stuck,
    MAX(finished_at) FILTER (WHERE status='completed') as last_ok,
    MAX(finished_at) FILTER (WHERE status='failed') as last_fail
  INTO v_sync FROM sicas_sync_jobs;

  SELECT
    COUNT(*) FILTER (WHERE is_vigente AND vigencia_hasta < NOW() AND vigencia_hasta > '1950-01-01' AND vigencia_hasta < '2100-01-01') as expired_v,
    COUNT(*) FILTER (WHERE prima_neta IS NULL OR prima_neta=0) as sin_prima,
    COUNT(*) FILTER (WHERE vigencia_hasta>'2100-01-01' OR vigencia_hasta<'1950-01-01') as anomalous,
    COUNT(*) FILTER (WHERE cliente IS NULL OR cliente='') as sin_cliente
  INTO v_qual FROM sicas_documents;

  SELECT
    COUNT(*) FILTER (WHERE vigencia_hasta BETWEEN NOW() AND NOW()+INTERVAL'30d' AND is_vigente AND vigencia_hasta>'1950-01-01' AND vigencia_hasta<'2100-01-01') as d30,
    COUNT(*) FILTER (WHERE vigencia_hasta BETWEEN NOW() AND NOW()+INTERVAL'60d' AND is_vigente AND vigencia_hasta>'1950-01-01' AND vigencia_hasta<'2100-01-01') as d60,
    COUNT(*) FILTER (WHERE vigencia_hasta BETWEEN NOW() AND NOW()+INTERVAL'90d' AND is_vigente AND vigencia_hasta>'1950-01-01' AND vigencia_hasta<'2100-01-01') as d90
  INTO v_ren FROM sicas_documents;

  RETURN jsonb_build_object(
    'config', jsonb_build_object(
      'endpoint', v_cfg.endpoint, 'use_rest', v_cfg.use_rest,
      'keycode', v_cfg.current_report_code, 'auto_sync', v_cfg.auto_sync_enabled,
      'local_first', v_cfg.local_first_mode,
      'last_test_at', v_cfg.last_test_at, 'last_test_ok', v_cfg.last_test_success
    ),
    'documents', jsonb_build_object(
      'total', v_docs.total, 'vigentes', v_docs.vigentes, 'renovables', v_docs.renovables,
      'con_usuario', v_docs.con_usuario, 'sin_usuario', v_docs.total - v_docs.con_usuario,
      'total_vendors', v_docs.total_vendors,
      'pct_mapeados', ROUND((v_docs.con_usuario::numeric / NULLIF(v_docs.total,0) * 100)::numeric, 2),
      'last_sync', v_docs.last_sync
    ),
    'vendor_mapping', jsonb_build_object(
      'total_mappings', v_map.total, 'active', v_map.active_m,
      'pending_review', v_map.pending_m, 'with_user', v_map.with_user,
      'pct_vendors_mapped', ROUND((v_map.active_m::numeric / NULLIF(v_docs.total_vendors,0) * 100)::numeric, 2)
    ),
    'sync_jobs', jsonb_build_object(
      'completed', v_sync.completed, 'failed', v_sync.failed, 'stuck', v_sync.stuck,
      'last_success', v_sync.last_ok, 'last_failure', v_sync.last_fail,
      'hours_since_success', ROUND(EXTRACT(EPOCH FROM (NOW() - v_sync.last_ok)) / 3600)
    ),
    'data_quality', jsonb_build_object(
      'expired_vigentes', v_qual.expired_v, 'sin_prima', v_qual.sin_prima,
      'anomalous_dates', v_qual.anomalous, 'sin_cliente', v_qual.sin_cliente
    ),
    'renewals', jsonb_build_object('next_30d', v_ren.d30, 'next_60d', v_ren.d60, 'next_90d', v_ren.d90),
    'generated_at', now()
  );
END;
$$;

-- =============================================
-- 9. FUNCIÓN: Sincronizar stats de mappings
-- =============================================
CREATE OR REPLACE FUNCTION sicas_sync_mapping_stats()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE sicas_vendor_user_mappings m SET
    total_docs = s.cnt, total_prima_neta = COALESCE(s.prima,0),
    last_doc_date = s.last_doc, updated_at = now()
  FROM (
    SELECT vend_id, COUNT(*) as cnt, SUM(prima_neta) as prima, MAX(fecha_captura) as last_doc
    FROM sicas_documents GROUP BY vend_id
  ) s WHERE m.vend_id = s.vend_id;
END;
$$;

-- =============================================
-- 10. Activar local_first_mode
-- =============================================
UPDATE sicas_config SET local_first_mode = true;

-- =============================================
-- 11. Corregir pólizas vencidas
-- =============================================
SELECT sicas_fix_expired_vigentes(true);

-- =============================================
-- 12. Construir catálogo de aseguradoras
-- =============================================
SELECT sicas_build_derived_aseguradoras();

-- =============================================
-- 13. Ejecutar auto-mapeo inicial
-- =============================================
SELECT sicas_auto_map_vendors(false);

-- =============================================
-- 14. Sincronizar stats
-- =============================================
SELECT sicas_sync_mapping_stats();
