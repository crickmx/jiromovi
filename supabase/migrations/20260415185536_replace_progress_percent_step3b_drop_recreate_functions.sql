/*
  # Replace progress_percent - Step 3b: Drop and recreate functions + trigger
*/

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_conversion_kpis(timestamptz, timestamptz, uuid, uuid);
DROP FUNCTION IF EXISTS get_conversion_ranking(timestamptz, timestamptz, uuid);
DROP FUNCTION IF EXISTS get_tramites_kpis_by_status(timestamptz, timestamptz, uuid);

-- Update resultado trigger
CREATE OR REPLACE FUNCTION calculate_ticket_resultado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_activity_type_name text;
  v_estatus_nombre text;
  v_is_cotizacion_emision boolean := false;
BEGIN
  IF NEW.tipo_tramite != 'registro_actividad' THEN
    RETURN NEW;
  END IF;

  IF NEW.activity_subtype_id IS NOT NULL THEN
    SELECT nombre INTO v_activity_type_name
    FROM tramite_activity_types
    WHERE id = NEW.activity_subtype_id;
    v_is_cotizacion_emision := (
      lower(v_activity_type_name) LIKE '%cotizaci%' OR
      lower(v_activity_type_name) LIKE '%emisi%'
    );
  END IF;

  IF NEW.estatus_id IS NOT NULL THEN
    SELECT nombre INTO v_estatus_nombre
    FROM ticket_estatus
    WHERE id = NEW.estatus_id;
  END IF;

  IF v_is_cotizacion_emision THEN
    IF v_estatus_nombre IN ('Emitido (Ganado)', 'Emitido') THEN
      NEW.resultado := 'ganado';
      NEW.cerrado := true;
      IF NEW.fecha_cierre IS NULL THEN
        NEW.fecha_cierre := now();
      END IF;
    ELSIF v_estatus_nombre IN ('No Emitido (Perdido)', 'No Emitido') THEN
      NEW.resultado := 'perdido';
      NEW.cerrado := true;
      IF NEW.fecha_cierre IS NULL THEN
        NEW.fecha_cierre := now();
      END IF;
    ELSE
      NEW.resultado := 'en_progreso';
    END IF;
  ELSE
    IF v_estatus_nombre IN ('Emitido (Ganado)', 'No Emitido (Perdido)', 'Cerrado') THEN
      NEW.cerrado := true;
      IF NEW.fecha_cierre IS NULL THEN
        NEW.fecha_cierre := now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_ticket_resultado ON tickets;
CREATE TRIGGER trg_calculate_ticket_resultado
  BEFORE INSERT OR UPDATE OF estatus_id, activity_subtype_id
  ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION calculate_ticket_resultado();

-- get_conversion_kpis
CREATE FUNCTION get_conversion_kpis(
  p_fecha_inicio timestamptz DEFAULT NULL,
  p_fecha_fin timestamptz DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_tramites bigint,
  total_emitidos bigint,
  total_no_emitidos bigint,
  total_en_proceso bigint,
  tasa_conversion numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT t.resultado, u.oficina_id
    FROM tickets t
    LEFT JOIN usuarios u ON u.id = t.agente_usuario_id
    WHERE t.tipo_tramite = 'registro_actividad'
      AND t.activity_subtype_id IN (
        SELECT id FROM tramite_activity_types
        WHERE lower(nombre) LIKE '%cotizaci%' OR lower(nombre) LIKE '%emisi%'
      )
      AND (p_fecha_inicio IS NULL OR t.fecha_creacion >= p_fecha_inicio)
      AND (p_fecha_fin IS NULL OR t.fecha_creacion <= p_fecha_fin)
      AND (p_oficina_id IS NULL OR u.oficina_id = p_oficina_id)
      AND (p_usuario_id IS NULL OR t.agente_usuario_id = p_usuario_id)
      AND t.deleted_at IS NULL
  )
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE resultado = 'ganado')::bigint,
    COUNT(*) FILTER (WHERE resultado = 'perdido')::bigint,
    COUNT(*) FILTER (WHERE resultado = 'en_progreso' OR resultado IS NULL)::bigint,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE resultado = 'ganado')::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0
    END
  FROM base;
END;
$$;

-- get_conversion_ranking
CREATE FUNCTION get_conversion_ranking(
  p_fecha_inicio timestamptz DEFAULT NULL,
  p_fecha_fin timestamptz DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL
)
RETURNS TABLE (
  agente_id uuid,
  agente_nombre text,
  oficina_nombre text,
  total_tramites bigint,
  total_emitidos bigint,
  total_no_emitidos bigint,
  total_en_proceso bigint,
  tasa_conversion numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.nombre_completo,
    COALESCE(o.nombre, 'Sin oficina'),
    COUNT(t.id)::bigint,
    COUNT(t.id) FILTER (WHERE t.resultado = 'ganado')::bigint,
    COUNT(t.id) FILTER (WHERE t.resultado = 'perdido')::bigint,
    COUNT(t.id) FILTER (WHERE t.resultado = 'en_progreso' OR t.resultado IS NULL)::bigint,
    CASE WHEN COUNT(t.id) > 0
      THEN ROUND((COUNT(t.id) FILTER (WHERE t.resultado = 'ganado')::numeric / COUNT(t.id)::numeric) * 100, 1)
      ELSE 0
    END
  FROM usuarios u
  LEFT JOIN tickets t ON t.agente_usuario_id = u.id
    AND t.tipo_tramite = 'registro_actividad'
    AND t.activity_subtype_id IN (
      SELECT id FROM tramite_activity_types
      WHERE lower(nombre) LIKE '%cotizaci%' OR lower(nombre) LIKE '%emisi%'
    )
    AND (p_fecha_inicio IS NULL OR t.fecha_creacion >= p_fecha_inicio)
    AND (p_fecha_fin IS NULL OR t.fecha_creacion <= p_fecha_fin)
    AND t.deleted_at IS NULL
  LEFT JOIN oficinas o ON o.id = u.oficina_id
  WHERE (p_oficina_id IS NULL OR u.oficina_id = p_oficina_id)
    AND u.estado = 'activo'
  GROUP BY u.id, u.nombre_completo, o.nombre
  HAVING COUNT(t.id) > 0
  ORDER BY COUNT(t.id) FILTER (WHERE t.resultado = 'ganado') DESC;
END;
$$;

-- get_tramites_kpis_by_status (new)
CREATE FUNCTION get_tramites_kpis_by_status(
  p_fecha_inicio timestamptz DEFAULT NULL,
  p_fecha_fin timestamptz DEFAULT NULL,
  p_oficina_id uuid DEFAULT NULL
)
RETURNS TABLE (
  estatus_nombre text,
  estatus_color text,
  total bigint,
  porcentaje numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT te.nombre, te.color, COUNT(t.id)::bigint as cnt
    FROM tickets t
    JOIN ticket_estatus te ON te.id = t.estatus_id
    LEFT JOIN usuarios u ON u.id = t.agente_usuario_id
    WHERE t.tipo_tramite = 'registro_actividad'
      AND (p_fecha_inicio IS NULL OR t.fecha_creacion >= p_fecha_inicio)
      AND (p_fecha_fin IS NULL OR t.fecha_creacion <= p_fecha_fin)
      AND (p_oficina_id IS NULL OR u.oficina_id = p_oficina_id)
      AND t.deleted_at IS NULL
    GROUP BY te.nombre, te.color
  ),
  total_cte AS (SELECT COALESCE(SUM(cnt), 1) as grand_total FROM base)
  SELECT b.nombre, b.color, b.cnt,
    ROUND((b.cnt::numeric / tc.grand_total::numeric) * 100, 1)
  FROM base b, total_cte tc
  ORDER BY b.cnt DESC;
END;
$$;
