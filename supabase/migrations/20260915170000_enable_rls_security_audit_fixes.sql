-- ==============================================================================
-- Migration: 20260915170000_enable_rls_security_audit_fixes.sql
-- Fix: Habilitar RLS en tablas faltantes reportadas por el Security Advisor de Supabase
-- Proyecto: MOVI Digital (qhwvuuyjhcennqccgvse)
-- ==============================================================================

-- 1. Tabla: multicotizador_gmm_folio_counter
-- Usada internamente por la función SECURITY DEFINER generate_multicotizador_gmm_folio()
ALTER TABLE IF EXISTS public.multicotizador_gmm_folio_counter ENABLE ROW LEVEL SECURITY;

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


-- 2. Tabla: tramites_grupos_reglas
-- Asegurar que RLS esté activado explícitamente (las políticas ya fueron definidas en 20260622000003)
ALTER TABLE IF EXISTS public.tramites_grupos_reglas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tramites_grupos_reglas_service" ON public.tramites_grupos_reglas;
CREATE POLICY "tramites_grupos_reglas_service"
  ON public.tramites_grupos_reglas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 3. Script dinámico de salvaguarda: Habilitar RLS en cualquier tabla de 'public' que lo tenga deshabilitado
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
    RAISE NOTICE 'RLS activado en: %', r.tablename;
  END LOOP;
END $$;
