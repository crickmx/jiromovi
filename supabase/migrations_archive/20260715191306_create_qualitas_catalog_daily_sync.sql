-- Quálitas official catalog mirror and daily refresh infrastructure.
-- The daily job never deletes the last valid snapshot when the upstream
-- source is unavailable.

ALTER TABLE public.multi_autos_catalogo_vehiculos
  ADD COLUMN IF NOT EXISTS catalog_source text NOT NULL DEFAULT 'legacy_seed',
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS source_file_date date,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_sync_id text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_multi_autos_catalog_source_key
  ON public.multi_autos_catalogo_vehiculos (catalog_source, source_key);

CREATE INDEX IF NOT EXISTS idx_multi_autos_catalog_active_lookup
  ON public.multi_autos_catalogo_vehiculos (catalog_source, active, marca, anio, modelo);

CREATE TABLE IF NOT EXISTS public.multi_autos_catalog_sync_status (
  source text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'failed', 'awaiting_source')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  source_file text,
  source_file_date date,
  row_count integer NOT NULL DEFAULT 0,
  sync_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.multi_autos_catalog_sync_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_multi_autos_catalog_sync_status" ON public.multi_autos_catalog_sync_status;
CREATE POLICY "read_multi_autos_catalog_sync_status"
  ON public.multi_autos_catalog_sync_status FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.multi_autos_catalog_sync_status (
  source, status, source_file, source_file_date
) VALUES (
  'qualitas_official', 'pending', 'EMICAT2406_01072024.xlsx', DATE '2024-07-01'
)
ON CONFLICT (source) DO NOTHING;

CREATE OR REPLACE FUNCTION public.qualitas_catalog_is_loaded()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.multi_autos_catalogo_vehiculos
    WHERE catalog_source = 'qualitas_official' AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_catalog_marcas()
RETURNS TABLE(marca text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT v.marca
  FROM public.multi_autos_catalogo_vehiculos v
  WHERE v.active = true
    AND (
      (public.qualitas_catalog_is_loaded() AND v.catalog_source = 'qualitas_official')
      OR (NOT public.qualitas_catalog_is_loaded() AND v.catalog_source <> 'qualitas_official')
    )
  ORDER BY v.marca;
$$;

CREATE OR REPLACE FUNCTION public.get_catalog_anios(p_marca text)
RETURNS TABLE(anio integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT v.anio
  FROM public.multi_autos_catalogo_vehiculos v
  WHERE v.active = true AND v.marca = p_marca
    AND (
      (public.qualitas_catalog_is_loaded() AND v.catalog_source = 'qualitas_official')
      OR (NOT public.qualitas_catalog_is_loaded() AND v.catalog_source <> 'qualitas_official')
    )
  ORDER BY v.anio DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_catalog_modelos(p_marca text, p_anio integer)
RETURNS TABLE(modelo text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT v.modelo
  FROM public.multi_autos_catalogo_vehiculos v
  WHERE v.active = true AND v.marca = p_marca AND v.anio = p_anio
    AND (
      (public.qualitas_catalog_is_loaded() AND v.catalog_source = 'qualitas_official')
      OR (NOT public.qualitas_catalog_is_loaded() AND v.catalog_source <> 'qualitas_official')
    )
  ORDER BY v.modelo;
$$;

GRANT EXECUTE ON FUNCTION public.qualitas_catalog_is_loaded() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_catalog_marcas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_catalog_anios(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_catalog_modelos(text, integer) TO authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.qualitas_catalog_sync_auth (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  token_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.verify_qualitas_catalog_sync_token(p_token_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.qualitas_catalog_sync_auth
    WHERE singleton = true AND token_hash = p_token_hash
  );
$$;

REVOKE ALL ON FUNCTION public.verify_qualitas_catalog_sync_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_qualitas_catalog_sync_token(text) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qualitas-catalog-daily-sync') THEN
    PERFORM cron.unschedule('qualitas-catalog-daily-sync');
  END IF;
END $$;

SELECT cron.schedule(
  'qualitas-catalog-daily-sync',
  '15 7 * * *',
  $job$
    SELECT net.http_post(
      url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/multi-autos-catalog-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'anon_key'
          LIMIT 1
        ),
        'apikey', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'anon_key'
          LIMIT 1
        ),
        'X-Catalog-Import-Token', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'qualitas_catalog_sync_token'
          LIMIT 1
        )
      ),
      body := '{"action":"sync","triggeredBy":"cron-daily"}'::jsonb
    );
  $job$
);
