/*
  # Create Home Dashboard Summary Functions

  1. New Functions
    - `get_home_production_comparison(p_user_id uuid)` - Returns production comparison current year vs same period last year
    - `get_home_next_renewals(p_user_id uuid, p_limit int)` - Returns next N renewals about to expire
    - `get_home_latest_emissions(p_user_id uuid, p_limit int)` - Returns last N emitted documents

  2. Security
    - All functions use SECURITY DEFINER with proper search_path
    - Scope filtering by role (admin=all, gerente=office, agente=self)

  3. Notes
    - Uses sicas_documents table as data source
    - Compares same calendar period (Jan 1 to current date) year over year
    - Goal/projection is +20% over previous year same period
*/

-- Function: Production Comparison Summary
CREATE OR REPLACE FUNCTION public.get_home_production_comparison(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_rol text;
  user_oficina_id uuid;
  current_year int := EXTRACT(year FROM NOW())::int;
  prev_year int := current_year - 1;
  current_doy int := EXTRACT(doy FROM NOW())::int;
  result jsonb;
  curr_prima numeric := 0;
  curr_polizas int := 0;
  prev_prima numeric := 0;
  prev_polizas int := 0;
  meta_prima numeric := 0;
  meta_polizas int := 0;
BEGIN
  -- Get user role and office
  SELECT rol, oficina_id INTO user_rol, user_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF user_rol IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Current year (Jan 1 to today)
  SELECT COALESCE(SUM(prima_neta), 0), COUNT(*)
  INTO curr_prima, curr_polizas
  FROM sicas_documents
  WHERE fecha_captura >= make_date(current_year, 1, 1)
    AND fecha_captura < NOW()
    AND (
      user_rol = 'Administrador'
      OR (user_rol = 'Gerente' AND oficina_id = user_oficina_id)
      OR (user_rol IN ('Empleado') AND oficina_id = user_oficina_id)
      OR (user_rol = 'Agente' AND usuario_id = p_user_id)
    );

  -- Previous year same period (Jan 1 to same day of year)
  SELECT COALESCE(SUM(prima_neta), 0), COUNT(*)
  INTO prev_prima, prev_polizas
  FROM sicas_documents
  WHERE fecha_captura >= make_date(prev_year, 1, 1)
    AND fecha_captura < (make_date(prev_year, 1, 1) + (current_doy || ' days')::interval)
    AND (
      user_rol = 'Administrador'
      OR (user_rol = 'Gerente' AND oficina_id = user_oficina_id)
      OR (user_rol IN ('Empleado') AND oficina_id = user_oficina_id)
      OR (user_rol = 'Agente' AND usuario_id = p_user_id)
    );

  -- Meta: +20% over previous year same period
  meta_prima := prev_prima * 1.20;
  meta_polizas := CEIL(prev_polizas * 1.20);

  result := jsonb_build_object(
    'current_year', current_year,
    'prev_year', prev_year,
    'current_prima', ROUND(curr_prima, 2),
    'current_polizas', curr_polizas,
    'prev_prima', ROUND(prev_prima, 2),
    'prev_polizas', prev_polizas,
    'meta_prima', ROUND(meta_prima, 2),
    'meta_polizas', meta_polizas,
    'growth_prima_pct', CASE WHEN prev_prima > 0 THEN ROUND(((curr_prima - prev_prima) / prev_prima) * 100, 1) ELSE 0 END,
    'growth_polizas_pct', CASE WHEN prev_polizas > 0 THEN ROUND(((curr_polizas::numeric - prev_polizas) / prev_polizas) * 100, 1) ELSE 0 END,
    'avance_meta_prima_pct', CASE WHEN meta_prima > 0 THEN ROUND((curr_prima / meta_prima) * 100, 1) ELSE 0 END,
    'avance_meta_polizas_pct', CASE WHEN meta_polizas > 0 THEN ROUND((curr_polizas::numeric / meta_polizas) * 100, 1) ELSE 0 END
  );

  RETURN result;
END;
$$;

-- Function: Next Renewals
CREATE OR REPLACE FUNCTION public.get_home_next_renewals(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_rol text;
  user_oficina_id uuid;
  result jsonb;
BEGIN
  SELECT rol, oficina_id INTO user_rol, user_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF user_rol IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO result
  FROM (
    SELECT 
      id,
      id_docto,
      poliza,
      cliente,
      compania,
      ramo,
      prima_neta,
      vigencia_hasta,
      GREATEST(0, EXTRACT(day FROM vigencia_hasta - NOW())::int) as dias_restantes,
      CASE
        WHEN vigencia_hasta <= NOW() + interval '7 days' THEN 'critico'
        WHEN vigencia_hasta <= NOW() + interval '15 days' THEN 'urgente'
        WHEN vigencia_hasta <= NOW() + interval '30 days' THEN 'proximo'
        ELSE 'normal'
      END as urgencia
    FROM sicas_documents
    WHERE vigencia_hasta > NOW()
      AND vigencia_hasta < NOW() + interval '90 days'
      AND is_vigente = true
      AND (
        user_rol = 'Administrador'
        OR (user_rol = 'Gerente' AND oficina_id = user_oficina_id)
        OR (user_rol IN ('Empleado') AND oficina_id = user_oficina_id)
        OR (user_rol = 'Agente' AND usuario_id = p_user_id)
      )
    ORDER BY vigencia_hasta ASC
    LIMIT p_limit
  ) r;

  RETURN result;
END;
$$;

-- Function: Latest Emissions
CREATE OR REPLACE FUNCTION public.get_home_latest_emissions(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_rol text;
  user_oficina_id uuid;
  result jsonb;
BEGIN
  SELECT rol, oficina_id INTO user_rol, user_oficina_id
  FROM usuarios WHERE id = p_user_id;

  IF user_rol IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO result
  FROM (
    SELECT 
      id,
      id_docto,
      poliza,
      cliente,
      compania,
      ramo,
      prima_neta,
      fecha_captura,
      status_texto
    FROM sicas_documents
    WHERE fecha_captura IS NOT NULL
      AND (
        user_rol = 'Administrador'
        OR (user_rol = 'Gerente' AND oficina_id = user_oficina_id)
        OR (user_rol IN ('Empleado') AND oficina_id = user_oficina_id)
        OR (user_rol = 'Agente' AND usuario_id = p_user_id)
      )
    ORDER BY fecha_captura DESC
    LIMIT p_limit
  ) r;

  RETURN result;
END;
$$;
