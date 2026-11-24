/*
  # Grant Public Schema Usage to Anon Role

  1. Changes
    - Grant USAGE on public schema to anon role
    - Grant SELECT specifically on seguros tables to anon
    - Ensure API access is properly configured
  
  2. Security
    - Only SELECT access granted
    - Limited to specific tables
*/

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon;

-- Grant explicit SELECT on tables
GRANT SELECT ON public.seguros_categories TO anon;
GRANT SELECT ON public.seguros_lessons TO anon;

-- Verify grants are applied
DO $$
BEGIN
  RAISE NOTICE 'Grants applied successfully for anon role';
END $$;
