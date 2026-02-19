/*
  # Fix Analytics Views Permissions

  1. Security
    - Enable RLS on analytics views
    - Add policies for admin access to analytics views
    - Grant SELECT permissions to authenticated users

  2. Notes
    - Analytics views should only be accessible to admins
    - Views query seguros_lessons_progress and seguros_aula_virtual_sessions
*/

-- Enable RLS on analytics views
ALTER VIEW v_analytics_lecciones_stats SET (security_invoker = true);
ALTER VIEW v_analytics_usuarios_stats SET (security_invoker = true);
ALTER VIEW v_analytics_clases_stats SET (security_invoker = true);

-- Grant SELECT permissions to authenticated users
GRANT SELECT ON v_analytics_lecciones_stats TO authenticated;
GRANT SELECT ON v_analytics_usuarios_stats TO authenticated;
GRANT SELECT ON v_analytics_clases_stats TO authenticated;
