/*
  # Fix ambiguous function overloads for SICAS dashboard

  1. Changes
    - Drops the old versions of `get_sicas_dashboard_charts`, `get_sicas_dashboard_kpis`,
      and `get_sicas_dashboard_top` that lack the `p_vendedor_id` parameter
    - Keeps only the newer versions that include `p_vendedor_id` (with DEFAULT NULL)
    - This resolves PostgreSQL "could not choose best candidate function" errors
      when calling these functions without specifying `p_vendedor_id`

  2. Important Notes
    - The newer functions are supersets of the old ones (p_vendedor_id defaults to NULL)
    - No data changes, only function signature cleanup
*/

-- Drop the OLD overloads (the ones WITHOUT p_vendedor_id)
DROP FUNCTION IF EXISTS public.get_sicas_dashboard_charts(uuid, text, uuid, integer);
DROP FUNCTION IF EXISTS public.get_sicas_dashboard_kpis(uuid, text, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_sicas_dashboard_top(uuid, text, integer, text, uuid, date, date);
