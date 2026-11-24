-- ==============================================================================
-- Migration: 20260921000000_enable_rls_security_advisor_all_public_tables.sql
-- Fix: Subsanar alerta de seguridad de Supabase (rls_disabled_in_public)
-- Proyecto: MOVI Digital (qhwvuuyjhcennqccgvse)
-- ==============================================================================

-- 1. Habilitar RLS explícitamente en todas las tablas del esquema public
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND rowsecurity = false
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    RAISE NOTICE 'RLS forzado en tabla pública: %', r.tablename;
  END LOOP;
END $$;

-- 2. Asegurar políticas de acceso para tablas internas y de servicio
DO $$
BEGIN
  -- multicotizador_gmm_folio_counter
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'multicotizador_gmm_folio_counter') THEN
    ALTER TABLE public.multicotizador_gmm_folio_counter ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "multicotizador_gmm_folio_counter_admin" ON public.multicotizador_gmm_folio_counter;
    CREATE POLICY "multicotizador_gmm_folio_counter_admin"
      ON public.multicotizador_gmm_folio_counter
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.usuarios u
          WHERE u.id = auth.uid() AND u.rol = 'Administrador' AND u.deleted_at IS NULL
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.usuarios u
          WHERE u.id = auth.uid() AND u.rol = 'Administrador' AND u.deleted_at IS NULL
        )
      );

    DROP POLICY IF EXISTS "multicotizador_gmm_folio_counter_service" ON public.multicotizador_gmm_folio_counter;
    CREATE POLICY "multicotizador_gmm_folio_counter_service"
      ON public.multicotizador_gmm_folio_counter
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- tramites_grupos_reglas
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tramites_grupos_reglas') THEN
    ALTER TABLE public.tramites_grupos_reglas ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "tramites_grupos_reglas_service" ON public.tramites_grupos_reglas;
    CREATE POLICY "tramites_grupos_reglas_service"
      ON public.tramites_grupos_reglas
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
